"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiFailure } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/constants";

type Step = "phone" | "code";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const requestCode = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ devCode?: string }>("/api/auth/request-otp", {
        phone,
      });
      setDevCode(res.devCode ?? null);
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setStep("code");
      toast.show(
        res.devCode
          ? "Test mode: your code is shown below."
          : "Code sent. Check your messages.",
        "success",
      );
    } catch (error) {
      const retry =
        error instanceof ApiFailure ? Number(error.data.retryAfter ?? 0) : 0;
      if (retry > 0) setCooldown(retry);
      toast.show(error instanceof Error ? error.message : "Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setBusy(true);
    try {
      const res = await api.post<{ profileComplete: boolean }>(
        "/api/auth/verify-otp",
        { phone, code: value },
      );
      router.replace(res.profileComplete ? "/garba" : "/setup");
    } catch (error) {
      setCode("");
      toast.show(error instanceof Error ? error.message : "Try again.", "error");
      setBusy(false);
    }
  };

  const localDigits = phone.replace(/\D/g, "").slice(-10);
  const phoneValid = /^[6-9]\d{9}$/.test(localDigits);

  return (
    <main className="app-shell flex min-h-dvh flex-col pt-safe pb-safe">
      <div className="py-5">
        <Link href="/" className="text-[14px] text-cream/55">
          {"←"} Back
        </Link>
      </div>

      <div className="flex flex-1 flex-col justify-center pb-8">
        <div className="animate-rise">
          <span className="animate-flicker inline-block text-[38px]">{"\u{1FA94}"}</span>
          <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight">
            {step === "phone" ? "Aavo, join the circle" : "Enter the code"}
          </h1>
          <p className="mt-1.5 text-[15px] leading-snug text-cream/65">
            {step === "phone"
              ? "We’ll send a one-time code to your mobile. Your number is never shown to anyone."
              : `Sent to +91 ${localDigits.slice(0, 5)} ${localDigits.slice(5)}.`}
          </p>
        </div>

        {step === "phone" ? (
          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (phoneValid && !busy) requestCode();
            }}
          >
            <div className="panel flex items-center gap-2 p-1.5 pl-4">
              <span className="text-[17px] font-semibold text-cream/70">
                +91
              </span>
              <span className="h-6 w-px bg-cream/20" />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                maxLength={13}
                className="field flex-1 border-0 bg-transparent tracking-[0.12em] focus:field-focus"
                style={{ boxShadow: "none" }}
              />
            </div>

            <button
              type="submit"
              disabled={!phoneValid || busy}
              className="btn-primary active:btn-primary-active disabled:opacity-45"
            >
              {busy ? "Sending…" : "Send code"}
            </button>

            <p className="text-center text-[12.5px] leading-relaxed text-cream/45">
              Indian mobile numbers only. Standard SMS rates may apply.
            </p>
          </form>
        ) : (
          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === OTP_LENGTH && !busy) verify(code);
            }}
          >
            {devCode && (
              <div className="rounded-2xl border border-parrot/40 bg-parrot/10 px-4 py-3 text-center">
                <p className="text-[12px] uppercase tracking-wider text-parrot/80">
                  Test mode — no SMS provider configured
                </p>
                <p className="font-display text-[26px] font-bold tracking-[0.3em] text-parrot">
                  {devCode}
                </p>
              </div>
            )}

            {/* One real input behind six boxes: real keyboards, real autofill. */}
            <div className="relative">
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                maxLength={OTP_LENGTH}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                  setCode(next);
                  if (next.length === OTP_LENGTH) verify(next);
                }}
                className="absolute inset-0 h-full w-full opacity-0"
                aria-label="One-time code"
              />
              <div className="pointer-events-none flex justify-between gap-2">
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`grid h-[58px] flex-1 place-items-center rounded-2xl border text-[24px] font-bold transition-colors ${
                      i === code.length
                        ? "border-marigold bg-marigold/10"
                        : "border-gold/25 bg-night/50"
                    }`}
                  >
                    {code[i] ?? ""}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={code.length !== OTP_LENGTH || busy}
              className="btn-primary active:btn-primary-active disabled:opacity-45"
            >
              {busy ? "Checking…" : "Verify"}
            </button>

            <div className="flex items-center justify-between text-[13.5px]">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                }}
                className="text-cream/55"
              >
                Change number
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={requestCode}
                className="font-semibold text-marigold disabled:text-cream/35"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
