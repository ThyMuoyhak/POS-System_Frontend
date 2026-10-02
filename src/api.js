/**
 * Thin fetch wrapper around the ABA POS FastAPI backend.
 * Base url comes from REACT_APP_API_BASE (see Frontend_POS/.env).
 *
 * Every call carries the bearer token from ./auth.js; a 401 drops the session
 * so the app falls back to the sign-in screen.
 */
import { clearSession, getToken } from "./auth";

export const API_BASE = (
  process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export const ALLOW_MANUAL_CONFIRM =
  String(process.env.REACT_APP_ALLOW_MANUAL_CONFIRM || "true").toLowerCase() !==
  "false";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.append(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
}

async function request(path, { method = "GET", body, headers, auth = true } = {}) {
  const token = auth ? getToken() : "";
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE}. Make sure uvicorn is running.`,
      0,
      null
    );
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = text;
    }
  }

  if (!res.ok) {
    let detail = `Request failed (HTTP ${res.status})`;
    if (data && data.detail) {
      detail =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
    }
    // Session gone/expired/revoked -> forget it so the sign-in screen returns.
    if (res.status === 401 && auth) clearSession();
    throw new ApiError(detail, res.status, data);
  }
  return data;
}

export const api = {
  /* auth ------------------------------------------------------------------ */
  login: (username, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  logoutAll: () => request("/api/auth/logout-all", { method: "POST" }),
  me: () => request("/api/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/password", {
      method: "POST",
      body: { current_password: currentPassword, new_password: newPassword },
    }),
  listUsers: () => request("/api/auth/users"),
  createUser: (payload) =>
    request("/api/auth/users", { method: "POST", body: payload }),
  updateUser: (id, payload) =>
    request(`/api/auth/users/${id}`, { method: "PATCH", body: payload }),
  deleteUser: (id) => request(`/api/auth/users/${id}`, { method: "DELETE" }),
  auditLogs: (limit = 100) => request(`/api/auth/audit${qs({ limit })}`),

  /* system ---------------------------------------------------------------- */
  health: () => request("/api/health"),
  stats: () => request("/api/stats/summary"),
  webhookLogs: (limit = 50) => request(`/api/webhook/logs${qs({ limit })}`),

  /* categories ------------------------------------------------------------ */
  listCategories: () => request("/api/categories"),
  createCategory: (payload) =>
    request("/api/categories", { method: "POST", body: payload }),
  updateCategory: (id, payload) =>
    request(`/api/categories/${id}`, { method: "PUT", body: payload }),
  deleteCategory: (id) =>
    request(`/api/categories/${id}`, { method: "DELETE" }),

  /* products -------------------------------------------------------------- */
  listProducts: (params = {}) => request(`/api/products${qs(params)}`),
  createProduct: (payload) =>
    request("/api/products", { method: "POST", body: payload }),
  updateProduct: (id, payload) =>
    request(`/api/products/${id}`, { method: "PUT", body: payload }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
  adjustStock: (id, amount) =>
    request(`/api/products/${id}/stock${qs({ amount })}`, { method: "POST" }),

  /* orders ---------------------------------------------------------------- */
  listOrders: (params = {}) => request(`/api/orders${qs(params)}`),
  getOrder: (id) => request(`/api/orders/${id}`),
  createOrder: (payload) =>
    request("/api/orders", { method: "POST", body: payload }),
  checkPayment: (id) =>
    request(`/api/orders/${id}/check-payment`, { method: "POST" }),
  markPaid: (id, amount) =>
    request(
      `/api/orders/${id}/mark-paid${qs(
        amount === undefined || amount === null ? {} : { amount }
      )}`,
      { method: "POST" }
    ),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: "POST" }),

  /* settings -------------------------------------------------------------- */
  getSettings: () => request("/api/settings"),
  saveSettings: (payload) =>
    request("/api/settings", { method: "PUT", body: payload }),
  abaUrls: () => request("/api/settings/aba-urls"),

  /* backup / import ------------------------------------------------------- */
  importData: (data, mode = "merge") =>
    request("/api/data/import", { method: "POST", body: { data, mode } }),
  resetData: (confirm) =>
    request(`/api/data/reset${qs({ confirm })}`, { method: "POST" }),
};

/** Trigger the browser download of the full JSON backup (admin only). */
export async function downloadBackup() {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/data/backup`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    clearSession();
    throw new ApiError("Your session expired - please sign in again.", 401, null);
  }
  if (!res.ok) {
    throw new ApiError(`Backup failed (HTTP ${res.status})`, res.status, null);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = match ? match[1] : `aba-pos-backup-${stamp}.json`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

/** Read a user-picked .json file into a plain object. */
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (err) {
        reject(new Error("That file is not valid JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

export default api;
