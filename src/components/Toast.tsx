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

const TONES: Record<Tone, string> = {
  info: "border-white/20 bg-white/10 text-cream",
  success: "border-peacock/50 bg-peacock/15 text-peacock",
  warn: "border-marigold/50 bg-marigold/15 text-marigold",
  error: "border-rani/50 bg-rani/15 text-rani",
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
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 pt-safe px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise w-full max-w-[420px] rounded-2xl border px-4 py-3 text-[14.5px] leading-snug backdrop-blur-xl ${TONES[t.tone]}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
