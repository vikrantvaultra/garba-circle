/**
 * Sign in with Google: the OAuth authorization-code flow with PKCE, by hand.
 * It is two redirects and one token exchange, so no SDK.
 *
 * The browser goes to Google with a random state, nonce and PKCE challenge,
 * all of which are also kept in a short-lived httpOnly cookie. Google sends it
 * back with a code; we swap the code for an ID token and check that the token
 * is signed by Google, meant for us, and carries the nonce we sent.
 */

import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const FLOW_COOKIE = "gc_google_flow";
export const FLOW_MAX_AGE_SECONDS = 10 * 60;

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Must match an "Authorized redirect URI" on the Google OAuth client exactly. */
export function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export type Flow = { state: string; nonce: string; verifier: string; next: string };

const random = () => randomBytes(32).toString("base64url");

export function startFlow(origin: string, next: string): { url: string; flow: Flow } {
  const flow: Flow = { state: random(), nonce: random(), verifier: random(), next };
  const challenge = createHash("sha256").update(flow.verifier).digest("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `${AUTHORIZE_URL}?${params}`, flow };
}

export function readFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const flow = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Flow;
    return flow.state && flow.nonce && flow.verifier ? flow : null;
  } catch {
    return null;
  }
}

export function encodeFlow(flow: Flow): string {
  return Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  givenName: string | null;
};

/** Swaps the code for an ID token and returns who it vouches for. */
export async function finishFlow(input: {
  code: string;
  origin: string;
  flow: Flow;
}): Promise<GoogleIdentity> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(input.origin),
      grant_type: "authorization_code",
      code_verifier: input.flow.verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);

  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new Error("Google returned no ID token");

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  if (payload.nonce !== input.flow.nonce) throw new Error("Google sign-in nonce mismatch");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Google ID token is missing sub or email");
  }
  if (payload.email_verified !== true) throw new Error("Google email is not verified");

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    givenName: typeof payload.given_name === "string" ? payload.given_name : null,
  };
}
