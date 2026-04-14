import { useEffect, useState } from "react";
import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType, duration?: number) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = "info", duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }));
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

const TYPE_STYLES: Record<ToastType, string> = {
  info: "border-blue-500/40 bg-blue-900/90 text-blue-100",
  success: "border-emerald-500/40 bg-emerald-900/90 text-emerald-100",
  warning: "border-amber-500/40 bg-amber-900/90 text-amber-100",
  error: "border-red-500/40 bg-red-900/90 text-red-100",
};

const TYPE_ICONS: Record<ToastType, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDismiss, 200);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        pointer-events-auto flex min-h-[48px] min-w-[280px] max-w-md items-center gap-3
        rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md
        transition-all duration-200
        ${leaving ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}
        ${TYPE_STYLES[toast.type]}
      `}
    >
      <span className="text-lg" aria-hidden="true">{TYPE_ICONS[toast.type]}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => { setLeaving(true); setTimeout(onDismiss, 200); }}
        aria-label="Bildirimi kapat"
        className="-m-1 flex h-8 w-8 items-center justify-center rounded-lg text-current opacity-70 transition hover:bg-white/10 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Toast container - place once at the root of the app.
 * Uses the toast store to display notifications.
 */
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}

/** Convenience helper to show a toast from anywhere. */
export function toast(message: string, type: ToastType = "info", duration?: number) {
  useToastStore.getState().show(message, type, duration);
}
