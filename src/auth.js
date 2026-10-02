/**
 * Login session for the POS.
 *
 * The bearer token lives in localStorage so a reload keeps you signed in. It is
 * attached to every request by ./api.js and stops working when it expires
 * (POS_TOKEN_TTL_HOURS), when you sign out, when an administrator resets the
 * password or disables the account.
 *
 * Note: localStorage is readable by JavaScript running on this origin. The POS
 * ships no third-party scripts (the ABA checkout plugin was removed) and React
 * escapes everything it renders, so a token cannot leak through injected HTML.
 */
const TOKEN_KEY = "aba_pos.token";
const USER_KEY = "aba_pos.user";

/** Fired on sign-in / sign-out so the app can re-render. */
export const SESSION_EVENT = "aba-pos:session";

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch (err) {
    return "";
  }
}

export function getUser() {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch (err) {
    /* private mode / storage full: the session still lives in memory */
  }
}

function notify() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/** Store a fresh token + user after a successful sign-in. */
export function setSession(token, user) {
  write(TOKEN_KEY, token);
  write(USER_KEY, user ? JSON.stringify(user) : null);
  notify();
}

/** Refresh the cached user (name / role) without touching the token. */
export function setUser(user) {
  write(USER_KEY, user ? JSON.stringify(user) : null);
  notify();
}

/** Drop the session (401 from the API, sign-out, or "sign out everywhere"). */
export function clearSession() {
  if (!getToken() && !getUser()) return;
  write(TOKEN_KEY, null);
  write(USER_KEY, null);
  notify();
}

/** Re-render on sign-in/out in this tab and in every other POS tab. */
export function subscribeToSession(handler) {
  window.addEventListener(SESSION_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(SESSION_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function isAdmin(user) {
  return !!user && String(user.role || "").toLowerCase() === "admin";
}
