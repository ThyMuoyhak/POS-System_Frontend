import React, { useEffect } from "react";
import { classNames, productInitials } from "../utils";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  loading = false,
  icon,
  ...rest
}) {
  const variants = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-300",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 disabled:bg-emerald-300",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600 disabled:bg-rose-300",
    ghost:
      "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400",
    subtle: "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:text-slate-400",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  return (
    <button
      type={type}
      className={classNames(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }) {
  return (
    <span
      className={classNames(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function Field({ label, hint, required, error, children, className }) {
  return (
    <label className={classNames("block", className)}>
      <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-400";

export function Input({ className, ...rest }) {
  return <input className={classNames(inputBase, className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={classNames(inputBase, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, rows = 3, ...rest }) {
  return (
    <textarea rows={rows} className={classNames(inputBase, className)} {...rest} />
  );
}

export function Checkbox({ label, checked, onChange, disabled, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? <span className="block text-xs text-slate-400">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Badge({ children, className }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1",
        className || "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      {children}
    </span>
  );
}

export function Thumb({ src, title, className }) {
  const [broken, setBroken] = React.useState(false);
  useEffect(() => setBroken(false), [src]);

  if (!src || broken) {
    return (
      <div
        className={classNames(
          "flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white",
          className
        )}
      >
        {productInitials(title) || "?"}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={title}
      loading="lazy"
      onError={() => setBroken(true)}
      className={classNames("bg-slate-100 object-cover", className)}
    />
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-400">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Card({ children, className }) {
  return (
    <div
      className={classNames(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
