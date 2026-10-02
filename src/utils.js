/** Shared helpers: money / date formatting and small UI primitives. */

export const CURRENCY_SYMBOL = { USD: "$", KHR: "៛", EUR: "€" };

export function formatMoney(value, currency = "USD") {
  const amount = Number(value || 0);
  const symbol = CURRENCY_SYMBOL[currency] || "";
  const decimals = currency === "KHR" ? 0 : 2;
  const text = amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return currency === "KHR" ? `${text} ${symbol}` : `${symbol}${text}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const STATUS_STYLES = {
  PAID: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-100 text-amber-700 ring-amber-200",
  FAILED: "bg-rose-100 text-rose-700 ring-rose-200",
  CANCELLED: "bg-slate-200 text-slate-600 ring-slate-300",
};

export const METHOD_STYLES = {
  CASH: "bg-sky-100 text-sky-700 ring-sky-200",
  KHQR: "bg-indigo-100 text-indigo-700 ring-indigo-200",
};

/** Placeholder thumbnail used when a product has no (working) image url. */
export function productInitials(title = "") {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
