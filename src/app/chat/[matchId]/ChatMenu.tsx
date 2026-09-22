"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/client/api";
import type { PublicProfile } from "@/components/ProfileCard";

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

  const report = async (reason: string) => {
    setBusy(true);
    try {
      await api.post("/api/report", {
        reportedId: partner.id,
        matchId,
        reason,
      });
      toast.show("Reported. Our team will review it.", "success");
      setReporting(false);
      setOpen(false);
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Chat options"
        className="-mr-1 p-1.5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-cream/60" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-night/80 backdrop-blur-sm"
            onClick={() => {
              setOpen(false);
              setReporting(false);
            }}
          />
          <div className="animate-sheet relative w-full max-w-[460px] rounded-t-[30px] border-t border-gold/30 bg-gradient-to-b from-plum to-night px-5 pt-3 pb-safe">
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-cream/25" />

            {reporting ? (
              <>
                <h3 className="font-display text-[20px] font-bold">
                  What went wrong?
                </h3>
                <div className="mt-4 space-y-2">
                  {REASONS.map((reason) => (
                    <button
                      key={reason.key}
                      disabled={busy}
                      onClick={() => report(reason.key)}
                      className="panel w-full p-3.5 text-left text-[15px] disabled:opacity-50"
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setReporting(false)}
                  className="btn-ghost mt-3 mb-2"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <h3 className="font-display text-[20px] font-bold">
                  {partner.name ?? "This dancer"}
                </h3>
                <p className="mt-1 text-[14px] text-cream/60">
                  Keep yourself safe. Both actions are immediate.
                </p>
                <div className="mt-4 space-y-2.5">
                  <button
                    onClick={() => setReporting(true)}
                    className="panel w-full p-4 text-left"
                  >
                    <span className="font-display text-[16px] font-bold text-marigold">
                      Report
                    </span>
                    <span className="mt-0.5 block text-[13.5px] text-cream/60">
                      Send this conversation to our safety team
                    </span>
                  </button>
                  <button
                    onClick={block}
                    disabled={busy}
                    className="panel w-full p-4 text-left disabled:opacity-50"
                  >
                    <span className="font-display text-[16px] font-bold text-rani">
                      Block and leave
                    </span>
                    <span className="mt-0.5 block text-[13.5px] text-cream/60">
                      They can never message or match with you again
                    </span>
                  </button>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="btn-ghost mt-3 mb-2"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
