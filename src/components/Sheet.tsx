"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import styles from "./sheet.module.css";

const noop = () => () => {};

/** False during server render and hydration, true once running in the browser. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * A bottom sheet that stays mounted, so it can slide out as well as in.
 * While closed it is inert: invisible to screen readers and the tab order.
 * Escape and a tap on the backdrop close it, focus moves into it on open and
 * goes back where it came from on close.
 *
 * It is portalled to <body>. A fixed-position element is positioned against
 * the nearest ancestor with a transform or backdrop-filter, so a sheet opened
 * from inside a blurred header would otherwise be laid out inside that header
 * and pushed off screen.
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
  const isClient = useIsClient();
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

  if (!isClient) return null;

  return createPortal(
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
    </div>,
    document.body,
  );
}
