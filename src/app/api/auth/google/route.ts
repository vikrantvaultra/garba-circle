import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/auth/session";
import {
  FLOW_COOKIE,
  FLOW_MAX_AGE_SECONDS,
  encodeFlow,
  googleConfigured,
  startFlow,
} from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/sign-in";

/** "Continue with Google" links here; it sends the browser on to Google. */
export async function GET(req: Request) {
  const url = new URL(req.url);

  if (!googleConfigured() || !authConfigured()) {
    console.error("[auth] GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or AUTH_SECRET is not set.");
    return NextResponse.redirect(new URL("/login?error=unavailable", url.origin));
  }

  const next = safeNext(url.searchParams.get("next")) ?? "";
  const { url: googleUrl, flow } = startFlow(url.origin, next);

  const jar = await cookies();
  jar.set(FLOW_COOKIE, encodeFlow(flow), {
    httpOnly: true,
    // Lax, so it comes back on Google's top-level redirect to the callback.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: FLOW_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(googleUrl);
}
