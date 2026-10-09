import { razorpayConfigured } from "@/lib/payments/razorpay";

/**
 * Deployment-mode checks.
 *
 * Two of this app's conveniences would be dangerous if they ever reached real
 * users: signing in as any email without Google, and the payment gateway that
 * approves everything. Both are fine locally and catastrophic in production,
 * so each one needs an explicit opt-in env var rather than defaulting on.
 */

export function isProduction(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

/**
 * Sign in as any email, skipping Google. Used by the e2e script; the app has
 * no button for it.
 *
 * Anyone could then sign in as anyone, so in production this requires
 * ALLOW_DEV_LOGIN=true and should only ever be set on a demo deployment with
 * no real users.
 */
export function devLoginAllowed(): boolean {
  return !isProduction() || process.env.ALLOW_DEV_LOGIN === "true";
}

/**
 * Approve purchases without charging. Same warning as above. Never once
 * Razorpay is configured: real keys mean real payments.
 */
export function devPaymentsAllowed(): boolean {
  if (razorpayConfigured()) return false;
  return !isProduction() || process.env.ALLOW_DEV_PAYMENTS === "true";
}

/** True when either shortcut is live on a deployed environment. */
export function isDemoDeployment(): boolean {
  return isProduction() && (devLoginAllowed() || devPaymentsAllowed());
}
