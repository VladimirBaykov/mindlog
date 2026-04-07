import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  findUserIdByStripeCustomerId,
  findUserIdByStripeSubscriptionId,
  markSubscriptionCanceled,
  syncSubscriptionFromStripe,
} from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function getUserIdFromSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.supabase_user_id || null;
}

function getUserIdFromCheckoutSession(
  session: Stripe.Checkout.Session
) {
  return session.metadata?.supabase_user_id || null;
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function getSubscriptionId(
  subscription:
    | string
    | Stripe.Subscription
    | null
    | undefined
) {
  if (!subscription) return null;
  return typeof subscription === "string"
    ? subscription
    : subscription.id;
}

async function resolveUserIdForSubscriptionEvent(params: {
  supabase: any;
  subscription: Stripe.Subscription;
}) {
  const directUserId = getUserIdFromSubscription(
    params.subscription
  );

  if (directUserId) {
    return directUserId;
  }

  const customerId = getCustomerId(params.subscription.customer);
  if (customerId) {
    const byCustomer = await findUserIdByStripeCustomerId(
      params.supabase,
      customerId
    );

    if (byCustomer) {
      return byCustomer;
    }
  }

  const subscriptionId = params.subscription.id;
  if (subscriptionId) {
    const bySubscription =
      await findUserIdByStripeSubscriptionId(
        params.supabase,
        subscriptionId
      );

    if (bySubscription) {
      return bySubscription;
    }
  }

  return null;
}

async function resolveUserIdForCheckoutEvent(params: {
  supabase: any;
  session: Stripe.Checkout.Session;
  stripe: Stripe;
}) {
  const directUserId = getUserIdFromCheckoutSession(
    params.session
  );

  if (directUserId) {
    return directUserId;
  }

  const customerId = getCustomerId(params.session.customer);
  if (customerId) {
    const byCustomer = await findUserIdByStripeCustomerId(
      params.supabase,
      customerId
    );

    if (byCustomer) {
      return byCustomer;
    }
  }

  const subscriptionId = getSubscriptionId(
    params.session.subscription
  );

  if (subscriptionId) {
    const bySubscription =
      await findUserIdByStripeSubscriptionId(
        params.supabase,
        subscriptionId
      );

    if (bySubscription) {
      return bySubscription;
    }

    const subscription = await params.stripe.subscriptions.retrieve(
      subscriptionId
    );

    return resolveUserIdForSubscriptionEvent({
      supabase: params.supabase,
      subscription,
    });
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const supabase = createSupabaseAdminClient();

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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = await resolveUserIdForCheckoutEvent({
          supabase,
          session,
          stripe,
        });

        const subscriptionId = getSubscriptionId(
          session.subscription
        );

        const customerId = getCustomerId(session.customer);

        if (!userId || !subscriptionId) {
          console.warn(
            "WEBHOOK checkout session could not resolve user/subscription",
            {
              eventType: event.type,
              sessionId: session.id,
              userId,
              subscriptionId,
              customerId,
            }
          );
          break;
        }

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

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = await resolveUserIdForSubscriptionEvent({
          supabase,
          subscription,
        });

        const customerId = getCustomerId(subscription.customer);

        const priceId =
          subscription.items.data[0]?.price?.id || null;

        if (!userId) {
          console.warn(
            "WEBHOOK subscription event could not resolve user",
            {
              eventType: event.type,
              subscriptionId: subscription.id,
              customerId,
            }
          );
          break;
        }

        await syncSubscriptionFromStripe(supabase, {
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          priceId,
        });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await markSubscriptionCanceled(
          supabase,
          subscription.id
        );

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