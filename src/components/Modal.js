import React, { useEffect } from "react";
import { classNames } from "../utils";
import { Button, Spinner, Thumb } from "./ui";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        className="absolute inset-0"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={classNames(
          "relative z-10 my-auto w-full overflow-hidden rounded-2xl bg-white shadow-2xl",
          SIZES[size]
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
              <path d="M6.3 5 5 6.3 8.7 10 5 13.7 6.3 15 10 11.3 13.7 15 15 13.7 11.3 10 15 6.3 13.7 5 10 8.7z" />
            </svg>
          </button>
        </header>

        <div className="scroll-thin max-h-[70vh] overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  danger = true,
  busy = false,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

export function ProductPreview({ product, currency, className }) {
  if (!product) return null;
  const hasDiscount = Number(product.discount || 0) > 0;
  return (
    <div className={classNames("flex items-center gap-3", className)}>
      <Thumb
        src={product.image_url}
        title={product.title}
        className="h-12 w-12 shrink-0 rounded-lg"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">
          {product.title}
        </p>
        <p className="text-xs text-slate-500">
          {hasDiscount ? (
            <span className="mr-1 text-slate-400 line-through">
              {(currency === "KHR" ? "៛" : "$") + Number(product.price).toFixed(currency === "KHR" ? 0 : 2)}
            </span>
          ) : null}
          <span className="font-semibold text-brand-700">
            {(currency === "KHR" ? "៛" : "$") + Number(product.final_price ?? product.price).toFixed(currency === "KHR" ? 0 : 2)}
          </span>
          <span className="ml-1 text-slate-400">· stock {product.stock}</span>
        </p>
      </div>
    </div>
  );
}

export { Spinner };
