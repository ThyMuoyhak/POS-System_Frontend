import React, { useState } from "react";
import api, { API_BASE, ApiError } from "../api";
import { setSession } from "../auth";
import { Button, Field, Input } from "../components/ui";

/**
 * Sign-in screen. The API refuses every call without a bearer token, so this is
 * the first thing the POS shows. Accounts are created by an administrator in
 * the Security tab (or with `python manage.py add-user` on the server).
 */
export default function LoginPage({ onSignedIn, notice }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.login(username.trim(), password);
      setSession(result.token, result.user);
      if (onSignedIn) onSignedIn(result.user);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl font-black text-white">
            ₳
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-800">ABA POS</h1>
            <p className="text-xs text-slate-500">Cash &amp; KHQR till</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="text-base font-bold text-slate-800">Sign in</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Only staff accounts can use the till.
            </p>
          </div>

          {notice ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              {notice}
            </p>
          ) : null}

          <Field label="Username" required>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="admin"
            />
          </Field>

          <Field label="Password" required>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" loading={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Forgot the password? On the server machine run
            <code className="mx-1 rounded bg-slate-100 px-1">python manage.py passwd admin</code>
            <br />
            API: <span className="font-mono">{API_BASE}</span>
          </p>
        </form>
      </div>
    </div>
  );
}
