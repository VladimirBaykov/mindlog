import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  markSubscriptionCanceled,
  syncSubscriptionFromStripe,
} from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getUserIdFromSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.supabase_user_id || null;
}

function getUserIdFromCheckoutSession(
  session: Stripe.Checkout.Session
) {
  return session.metadata?.supabase_user_id || null;
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const supabase = getAdminSupabase();

    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return new NextResponse("Missing webhook secret/signature", {
        status: 400,
      });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = getUserIdFromCheckoutSession(session);
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id || null;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;

        if (userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );

          const priceId =
            subscription.items.data[0]?.price?.id || null;

          await syncSubscriptionFromStripe(supabase, {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
            priceId,
          });
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = getUserIdFromSubscription(subscription);
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id || null;

        const priceId =
          subscription.items.data[0]?.price?.id || null;

        if (userId) {
          await syncSubscriptionFromStripe(supabase, {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
            priceId,
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await markSubscriptionCanceled(supabase, subscription.id);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("STRIPE WEBHOOK ERROR:", e);

    return new NextResponse(
      `Webhook Error: ${e.message || "Unknown error"}`,
      { status: 400 }
    );
  }
}