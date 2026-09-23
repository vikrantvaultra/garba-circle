"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/client/api";
import type { PublicProfile } from "@/lib/api";

const REASONS = [
  { key: "abusive", label: "Abusive language" },
  { key: "sexual", label: "Sexual or inappropriate" },
  { key: "asking_contact", label: "Asking for my number" },
  { key: "fake_profile", label: "Fake profile" },
  { key: "spam", label: "Spam or selling" },
  { key: "other", label: "Something else" },
] as const;

export function ChatMenu({
  partner,
  matchId,
}: {
  partner: PublicProfile;
  matchId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);

  const report = async (reason: string) => {
    setBusy(true);
    try {
      await api.post("/api/report", {
        reportedId: partner.id,
        matchId,
        reason,
      });
      toast.show("Reported. Our team will review it.", "success");
      close();
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : "Could not report.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    setBusy(true);
    try {
      await api.post("/api/block", { blockedId: partner.id, blocked: true });
      toast.show(`${partner.name ?? "They"} can no longer reach you.`, "success");
      router.replace("/matches");
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : "Could not block.",
        "error",
      );
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setReporting(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat options"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-cream/60 transition-colors hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-marigold"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      <Sheet open={open} onClose={close} labelledBy="chat-menu-title" initialFocus={firstRef}>
        {reporting ? (
          <>
            <h2 id="chat-menu-title" className="font-display text-[26px] leading-tight">
              What went wrong?
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              They are never told who reported them.
            </p>
            <div className="mt-4 grid gap-2">
              {REASONS.map((reason) => (
                <button
                  key={reason.key}
                  type="button"
                  disabled={busy}
                  onClick={() => report(reason.key)}
                  className="min-h-[50px] rounded-2xl border border-white/10 bg-deep/50 px-4 text-left text-[15px] font-medium transition-colors active:bg-white/5 disabled:opacity-50"
                >
                  {reason.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setReporting(false)} className="btn-ghost mt-3">
              Back
            </button>
          </>
        ) : (
          <>
            <h2 id="chat-menu-title" className="font-display text-[26px] leading-tight">
              {partner.name ?? "This dancer"}
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              Keep yourself safe. Both actions are immediate, and they are never
              told.
            </p>
            <div className="mt-4 grid gap-2.5">
              <button
                ref={firstRef}
                type="button"
                onClick={() => setReporting(true)}
                className="rounded-2xl border border-white/10 bg-deep/50 p-4 text-left transition-colors active:bg-white/5"
              >
                <span className="text-[16px] font-bold text-marigold">Report</span>
                <span className="mt-0.5 block text-[13.5px] text-muted">
                  Send this conversation to our safety team
                </span>
              </button>
              <button
                type="button"
                onClick={block}
                disabled={busy}
                className="rounded-2xl border border-white/10 bg-deep/50 p-4 text-left transition-colors active:bg-white/5 disabled:opacity-50"
              >
                <span className="text-[16px] font-bold text-rani">Block and leave</span>
                <span className="mt-0.5 block text-[13.5px] text-muted">
                  They can never message or match with you again
                </span>
              </button>
            </div>
            <button type="button" onClick={close} className="btn-ghost mt-3">
              Cancel
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
