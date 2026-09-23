"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import styles from "./sheet.module.css";

/**
 * A bottom sheet that stays mounted, so it can slide out as well as in.
 * While closed it is inert: invisible to screen readers and the tab order.
 * Escape and a tap on the backdrop close it, focus moves into it on open and
 * goes back where it came from on close.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  initialFocus,
  tier,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  initialFocus?: RefObject<HTMLElement | null>;
  tier?: string;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => {
      (initialFocus?.current ?? sheetRef.current)?.focus({ preventScroll: true });
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [open, initialFocus]);

  return (
    <div
      className={styles.backdrop}
      data-open={open}
      inert={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        data-tier={tier}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        <div className={styles.grab} aria-hidden />
        {children}
      </div>
    </div>
  );
}
