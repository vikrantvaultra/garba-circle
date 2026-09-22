/**
 * Deployment-mode checks.
 *
 * Two of this app's conveniences would be dangerous if they ever reached real
 * users: the OTP that prints itself on screen, and the payment gateway that
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
 * Show the OTP instead of sending an SMS.
 *
 * Anyone who can read the response can sign in as any number, so in production
 * this requires ALLOW_DEV_OTP=true and should only ever be set on a demo
 * deployment with no real users.
 */
export function devOtpAllowed(): boolean {
  const provider = process.env.SMS_PROVIDER ?? "console";
  if (provider !== "console") return false;
  return !isProduction() || process.env.ALLOW_DEV_OTP === "true";
}

/** Approve purchases without charging. Same warning as above. */
export function devPaymentsAllowed(): boolean {
  return !isProduction() || process.env.ALLOW_DEV_PAYMENTS === "true";
}

/** True when either shortcut is live on a deployed environment. */
export function isDemoDeployment(): boolean {
  return isProduction() && (devOtpAllowed() || devPaymentsAllowed());
}
