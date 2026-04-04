import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  ensureSubscriptionRow,
  resolveUserSubscription,
  setStripeCustomerId,
} from "@/lib/billing";
import { getStripe, getAppUrl } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const stripe = getStripe();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const billingInterval =
      body?.interval === "yearly" ? "yearly" : "monthly";

    const priceId =
      billingInterval === "yearly"
        ? process.env.STRIPE_PRICE_PRO_YEARLY
        : process.env.STRIPE_PRICE_PRO_MONTHLY;

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing Stripe price configuration" },
        { status: 500 }
      );
    }

    await ensureSubscriptionRow(supabase, user.id);
    const subscription = await resolveUserSubscription(
      supabase,
      user.id
    );

    if (subscription.isPro && subscription.stripeCustomerId) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${getAppUrl()}/profile`,
      });

      return NextResponse.json({ url: portal.url });
    }

    let stripeCustomerId = subscription.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;
      await setStripeCustomerId(supabase, user.id, customer.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${getAppUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getAppUrl()}/billing/cancel`,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (e: any) {
    console.error("BILLING CHECKOUT ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}