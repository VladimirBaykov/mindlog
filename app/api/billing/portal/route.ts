import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  ensureSubscriptionRow,
  resolveUserSubscription,
  setStripeCustomerId,
} from "@/lib/billing";
import { getStripe, resolveRequestOrigin } from "@/lib/stripe";

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

    await ensureSubscriptionRow(adminSupabase, user.id);

    const subscription = await resolveUserSubscription(
      adminSupabase,
      user.id
    );

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

    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/profile`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    console.error("BILLING PORTAL ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}