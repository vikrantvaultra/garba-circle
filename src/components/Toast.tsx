"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Tone = "info" | "success" | "warn" | "error";
type Toast = { id: number; text: string; tone: Tone };

const ToastContext = createContext<{
  show: (text: string, tone?: Tone) => void;
}>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/** A small mark in front of the text; the pill itself is always ivory. */
const TONES: Record<Tone, string> = {
  info: "bg-plum/40",
  success: "bg-parrot",
  warn: "bg-marigold",
  error: "bg-kumkum",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-5"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 104px)" }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise flex max-w-[400px] items-center gap-2.5 rounded-xl bg-cream px-[18px] py-3 text-[14px] font-semibold leading-snug text-plum shadow-[0_12px_30px_rgba(0,0,0,0.4)]"
          >
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TONES[t.tone]}`} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
