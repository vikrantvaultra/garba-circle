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

/** A small mark in front of the text; the pill itself is always white. */
const TONES: Record<Tone, string> = {
  info: "bg-cocoa/50",
  success: "bg-pista",
  warn: "bg-mango",
  error: "bg-havmor",
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
            className="animate-rise flex max-w-[400px] items-center gap-2.5 rounded-2xl border border-choco/8 bg-white px-[18px] py-3 text-[14px] font-bold leading-snug text-choco shadow-[0_14px_30px_-8px_rgba(89,51,42,0.45)]"
          >
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONES[t.tone]}`} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
