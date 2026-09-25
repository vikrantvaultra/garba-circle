import { z } from "zod";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { normalizeIndianMobile } from "@/lib/phone-number";
import {
  issueCode,
  recentRequestCount,
  secondsUntilResendAllowed,
} from "@/lib/auth/otp";
import { isDevOtp, sendOtp, SmsNotConfiguredError } from "@/lib/auth/sms";
import { authConfigured } from "@/lib/auth/session";
import { OTP_LENGTH } from "@/lib/constants";

const Body = z.object({ phone: z.string().min(6).max(20) });

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Enter your mobile number.");

    const phone = normalizeIndianMobile(parsed.data.phone);
    if (!phone) {
      return fail("That doesn’t look like an Indian mobile number.");
    }

    // Without a session secret nobody can be signed in: say so now, before a
    // code is issued (or used up) that can never work.
    if (!authConfigured()) {
      console.error("[auth] AUTH_SECRET is missing or shorter than 24 characters on this deployment.");
      return fail("Sign-in isn’t set up on this deployment yet. Please try later.", 503);
    }

    if (!rateLimit(`otp:${phone}`, 5, 15 * 60 * 1000)) {
      return fail("Too many attempts. Try again in a few minutes.", 429);
    }

    const cooldown = await secondsUntilResendAllowed(phone);
    if (cooldown > 0) {
      return fail(`Wait ${cooldown}s before asking for a new code.`, 429, {
        retryAfter: cooldown,
      });
    }

    if ((await recentRequestCount(phone)) >= 6) {
      return fail("Too many codes requested for this number today.", 429);
    }

    const code = await issueCode(phone);
    let result;
    try {
      result = await sendOtp(phone, code);
    } catch (error) {
      if (error instanceof SmsNotConfiguredError) {
        console.error("[otp]", error.message);
        return fail("Sign-in is temporarily unavailable. Please try later.", 503);
      }
      throw error;
    }

    return json({
      ok: true,
      phone,
      length: OTP_LENGTH,
      // Only ever populated by the console transport used in development.
      devCode: isDevOtp() ? result.devCode : undefined,
    });
  });
}
