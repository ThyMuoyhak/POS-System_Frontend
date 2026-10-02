import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { classNames } from "../utils";

const ToastContext = createContext({ push: () => {} });

const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const ICONS = { success: "✓", error: "!", info: "i", warning: "!" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = "info", timeout = 4200) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current, { id, message, tone }]);
      if (timeout) setTimeout(() => remove(id), timeout);
      return id;
    },
    [remove]
  );

  const value = useMemo(
    () => ({
      push,
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error", 6500),
      info: (m) => push(m, "info"),
      warning: (m) => push(m, "warning", 5500),
      dismiss: remove,
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={classNames(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg",
              TONES[toast.tone] || TONES.info
            )}
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-current/15 text-[10px] font-bold">
              {ICONS[toast.tone] || "i"}
            </span>
            <p className="flex-1 whitespace-pre-line break-words">{toast.message}</p>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              className="text-current opacity-50 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export default useToast;
