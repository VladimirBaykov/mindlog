import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  ensureSubscriptionRow,
  resolveUserSubscription,
} from "@/lib/billing";
import { getStripe, getAppUrl } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const stripe = getStripe();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await ensureSubscriptionRow(supabase, user.id);
    const subscription = await resolveUserSubscription(
      supabase,
      user.id
    );

    if (!subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account yet" },
        { status: 400 }
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getAppUrl()}/profile`,
    });

    return NextResponse.json({
      url: portal.url,
    });
  } catch (e: any) {
    console.error("BILLING PORTAL ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}