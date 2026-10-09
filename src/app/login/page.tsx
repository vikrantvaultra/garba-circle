import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { googleConfigured } from "@/lib/auth/google";
import { getCurrentUser } from "@/lib/auth/session";
import { landingFor, safeNext } from "@/lib/auth/sign-in";
import { GoogleButton, PasswordForm } from "./SignIn";

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again whenever you’re ready.",
  expired: "That took a little too long. Please try again.",
  failed: "Google sign-in didn’t go through. Please try again.",
  suspended: "This account has been suspended.",
  unavailable: "Sign-in isn’t set up on this deployment yet. Please try later.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);

  const user = await getCurrentUser();
  if (user && !user.suspendedAt) redirect(landingFor(user, next));

  // Until the Google client is set up, the button would only lead back here
  // with an error, so it isn't offered at all.
  const google = googleConfigured();
  const message =
    error && !(error === "unavailable" && !google) ? (ERRORS[error] ?? ERRORS.failed) : null;
  const href = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="app-shell flex min-h-dvh flex-col pb-safe">
      <BrandHeader
        title="Aavo, join the circle"
        sub={
          google
            ? "Sign in with Google, or with a username and password."
            : "Sign in with your username and password, or create an account."
        }
        aside={
          <Link href="/" className="rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-extrabold text-white">
            {"←"} Back
          </Link>
        }
      />

      <div className="flex flex-1 flex-col pb-8 pt-2">
        <div className="mt-7 space-y-4">
          {message && (
            <p
              role="alert"
              className="rounded-2xl border border-brand/25 bg-brand-soft/60 px-4 py-3 text-[14px] font-semibold leading-snug text-brand-deep"
            >
              {message}
            </p>
          )}

          {google && (
            <>
              <GoogleButton href={href} />

              <p className="text-center text-[12.5px] leading-relaxed text-cocoa">
                From Google we only use your name and email, and never show either.
              </p>

              <div className="flex items-center gap-3 py-1 text-[12px] font-extrabold uppercase tracking-wider text-cocoa">
                <span className="h-px flex-1 bg-choco/15" />
                or
                <span className="h-px flex-1 bg-choco/15" />
              </div>
            </>
          )}

          <PasswordForm next={next} google={google} />
        </div>
      </div>
    </main>
  );
}
