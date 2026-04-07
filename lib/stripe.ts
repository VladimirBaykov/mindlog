import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeInstance;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function assertStripePriceId(
  value: string | undefined,
  envName: string
) {
  if (!value) {
    throw new Error(`Missing ${envName}`);
  }

  if (value.startsWith("prod_")) {
    throw new Error(
      `${envName} must be a Stripe Price ID (price_...), not a Product ID (prod_...)`
    );
  }

  if (!value.startsWith("price_")) {
    throw new Error(
      `${envName} must start with price_...`
    );
  }

  return value;
}