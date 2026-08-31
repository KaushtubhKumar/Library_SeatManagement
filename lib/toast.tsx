"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };

const ToastContext = createContext<{ show: (message: string, kind?: Toast["kind"]) => void } | null>(null);

const KIND_STYLE: Record<Toast["kind"], string> = {
  success: "border-emerald-800 bg-emerald-950 text-emerald-300",
  error: "border-red-800 bg-red-950 text-red-300",
  info: "border-neutral-700 bg-neutral-900 text-neutral-200",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-20 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in pointer-events-auto max-w-sm w-full border rounded-xl px-4 py-3 text-sm shadow-lg ${KIND_STYLE[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Call show(message, "success" | "error" | "info") from any client component. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}