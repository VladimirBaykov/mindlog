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
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  return raw.replace(/\/+$/, "");
}

export function resolveRequestOrigin(req: Request) {
  const fromEnv = getAppUrl();

  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return fromEnv;
  }
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
    throw new Error(`${envName} must start with price_...`);
  }

  return value;
}