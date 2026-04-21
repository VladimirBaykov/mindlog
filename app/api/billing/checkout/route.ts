import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  ensureSubscriptionRow,
  resolveUserSubscription,
  setStripeCustomerId,
} from "@/lib/billing";
import {
  getStripe,
  assertStripePriceId,
  resolveRequestOrigin,
} from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const adminSupabase = createSupabaseAdminClient();
    const stripe = getStripe();
    const appUrl = resolveRequestOrigin(req);

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

    const rawPriceId =
      billingInterval === "yearly"
        ? process.env.STRIPE_PRICE_PRO_YEARLY
        : process.env.STRIPE_PRICE_PRO_MONTHLY;

    const priceId = assertStripePriceId(
      rawPriceId,
      billingInterval === "yearly"
        ? "STRIPE_PRICE_PRO_YEARLY"
        : "STRIPE_PRICE_PRO_MONTHLY"
    );

    await ensureSubscriptionRow(adminSupabase, user.id);

    const subscription = await resolveUserSubscription(
      adminSupabase,
      user.id
    );

    if (subscription.isPro && subscription.stripeCustomerId) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${appUrl}/profile`,
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

      await setStripeCustomerId(
        adminSupabase,
        user.id,
        customer.id
      );
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
      success_url: `${appUrl}/profile?upgraded=1&checkout=1`,
      cancel_url: `${appUrl}/billing/cancel`,
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