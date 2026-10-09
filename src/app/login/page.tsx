"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiFailure } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import { BrandHeader } from "@/components/brand/BrandHeader";
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
    <main className="app-shell flex min-h-dvh flex-col pb-safe">
      <BrandHeader
        eyebrow="Havmor Garba Circle"
        title={step === "phone" ? "Aavo, join the circle" : "Enter the code"}
        sub={
          step === "phone"
            ? "We’ll send a one-time code to your mobile. Your number is never shown to anyone."
            : `Sent to +91 ${localDigits.slice(0, 5)} ${localDigits.slice(5)}.`
        }
        aside={
          <Link href="/" className="rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-extrabold text-white">
            {"←"} Back
          </Link>
        }
      />

      <div className="flex flex-1 flex-col pb-8 pt-2">
        {step === "phone" ? (
          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (phoneValid && !busy) requestCode();
            }}
          >
            <div className="panel flex items-center gap-2 rounded-full p-1.5 pl-5">
              <span className="text-[17px] font-extrabold text-havmor">
                +91
              </span>
              <span className="h-6 w-px bg-choco/15" />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                maxLength={13}
                className="field flex-1 border-0 bg-transparent font-bold tracking-[0.12em] focus:field-focus"
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

            <p className="text-center text-[12.5px] leading-relaxed text-cocoa">
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
              <div className="rounded-2xl border border-pista/40 bg-pista/10 px-4 py-3 text-center">
                <p className="text-[12px] font-bold uppercase tracking-wider text-pista">
                  Test mode — no SMS provider configured
                </p>
                <p className="headline text-[26px] tracking-[0.3em] text-pista">
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
                    className={`grid h-[58px] flex-1 place-items-center rounded-2xl border-[1.5px] bg-white text-[24px] font-black transition-colors ${
                      i === code.length
                        ? "border-havmor shadow-[0_0_0_4px_rgba(211,0,43,0.12)]"
                        : "border-choco/15"
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
                className="font-bold text-choco-2"
              >
                Change number
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={requestCode}
                className="font-extrabold text-havmor disabled:text-cocoa/60"
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
