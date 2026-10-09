import { z } from "zod";
import { fail, guard, json } from "@/lib/api";
import { authConfigured } from "@/lib/auth/session";
import { signInWithGoogle } from "@/lib/auth/sign-in";
import { devLoginAllowed } from "@/lib/env";

const Body = z.object({ email: z.string().email().max(120) });

/**
 * Sign in as any email without Google, for the e2e script only; there is no
 * button for it. Anyone could sign in as anyone with this, so production
 * refuses it unless ALLOW_DEV_LOGIN=true.
 */
export async function POST(req: Request) {
  return guard(async () => {
    if (!devLoginAllowed()) return fail("Not found.", 404);
    if (!authConfigured()) return fail("AUTH_SECRET is not set.", 503);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Enter an email.");

    const email = parsed.data.email.toLowerCase();
    const result = await signInWithGoogle({
      sub: `dev:${email}`,
      email,
      givenName: null,
    });
    if (!result.ok) return fail("This account has been suspended.", 403);
    return json({ ok: true, profileComplete: result.user.profileComplete });
  });
}
