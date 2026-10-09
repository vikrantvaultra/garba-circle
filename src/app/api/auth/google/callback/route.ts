import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FLOW_COOKIE, finishFlow, readFlow } from "@/lib/auth/google";
import { landingFor, safeNext, signInWithGoogle } from "@/lib/auth/sign-in";

/** Google sends the browser back here with a code, or with an error if they backed out. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, url.origin));

  const jar = await cookies();
  const flow = readFlow(jar.get(FLOW_COOKIE)?.value);
  // Single use, whatever happens next.
  jar.delete({ name: FLOW_COOKIE, path: "/api/auth/google" });

  if (url.searchParams.get("error")) return back("cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // No flow cookie usually means the ten minutes ran out, or the sign-in was
  // started in another browser. A state mismatch is the CSRF check.
  if (!flow || !code || state !== flow.state) return back("expired");

  try {
    const identity = await finishFlow({ code, origin: url.origin, flow });
    const result = await signInWithGoogle(identity);
    if (!result.ok) return back("suspended");
    return NextResponse.redirect(
      new URL(landingFor(result.user, safeNext(flow.next)), url.origin),
    );
  } catch (error) {
    console.error("[auth] google callback", error);
    return back("failed");
  }
}
