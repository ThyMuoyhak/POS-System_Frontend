import React, { useCallback, useEffect, useState } from "react";
import api, { ApiError } from "../api";
import { clearSession } from "../auth";
import { useToast } from "../components/Toast";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "../components/ui";

const ROLE_LABEL = { admin: "Administrator", cashier: "Cashier" };

function roleTone(role) {
  return role === "admin"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}

function statusTone(code) {
  if (!code) return "bg-slate-100 text-slate-600 ring-slate-200";
  if (code < 300) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (code < 500) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function formatStamp(epochSeconds) {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString();
}

/**
 * Administrators only: staff accounts + roles, the audit trail and the
 * password of the signed-in operator. A cashier never sees this tab and the
 * API refuses the underlying calls with 403 anyway.
 */
export default function SecurityPage({ user }) {
  const toast = useToast();
  const [people, setPeople] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    full_name: "",
    password: "",
    role: "cashier",
  });
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });

  const fail = useCallback(
    (err) => toast.error(err instanceof ApiError ? err.message : String(err)),
    [toast]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accounts, logs] = await Promise.all([api.listUsers(), api.auditLogs(100)]);
      setPeople(accounts);
      setAudit(logs);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  const createAccount = async (event) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await api.createUser({
        username: newUser.username.trim(),
        full_name: newUser.full_name.trim() || null,
        password: newUser.password,
        role: newUser.role,
      });
      toast.success(`Account "${newUser.username.trim()}" created`);
      setNewUser({ username: "", full_name: "", password: "", role: "cashier" });
      load();
    } catch (err) {
      fail(err);
    } finally {
      setCreating(false);
    }
  };

  const changeOwnPassword = async (event) => {
    event.preventDefault();
    if (pwBusy) return;
    if (pw.next !== pw.repeat) {
      toast.error("The two new passwords do not match");
      return;
    }
    setPwBusy(true);
    try {
      const result = await api.changePassword(pw.current, pw.next);
      toast.success(result.detail || "Password updated");
      setPw({ current: "", next: "", repeat: "" });
    } catch (err) {
      fail(err);
    } finally {
      setPwBusy(false);
    }
  };

  const signOutEverywhere = async () => {
    if (!window.confirm("Sign this account out on every device, including this one?")) return;
    setPwBusy(true);
    try {
      await api.logoutAll();
      toast.info("Every device was signed out");
      clearSession(); // the token you are holding just stopped working
    } catch (err) {
      fail(err);
    } finally {
      setPwBusy(false);
    }
  };

  const resetPassword = async (account) => {
    const password = window.prompt(
      `New password for "${account.username}" (min 8 characters).\nThat device is signed out immediately.`
    );
    if (!password) return;
    setBusyId(account.id);
    try {
      await api.updateUser(account.id, { password });
      toast.success(`Password for "${account.username}" was reset`);
      load();
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (account, role) => {
    setBusyId(account.id);
    try {
      await api.updateUser(account.id, { role });
      toast.success(`${account.username} is now a ${ROLE_LABEL[role].toLowerCase()}`);
      load();
    } catch (err) {
      fail(err);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (account) => {
    setBusyId(account.id);
    try {
      await api.updateUser(account.id, { is_active: !account.is_active });
      toast.success(`${account.username} ${account.is_active ? "disabled" : "enabled"}`);
      load();
    } catch (err) {
      fail(err);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const removeAccount = async (account) => {
    if (!window.confirm(`Delete the account "${account.username}"? This cannot be undone.`)) return;
    setBusyId(account.id);
    try {
      await api.deleteUser(account.id);
      toast.success(`"${account.username}" deleted`);
      load();
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">My account</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            Signed in as <span className="font-semibold">{user.username}</span>
            <Badge className={roleTone(user.role)}>{ROLE_LABEL[user.role] || user.role}</Badge>
          </p>
          <form onSubmit={changeOwnPassword} className="mt-3 space-y-3">
            <Field label="Current password" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(event) => setPw({ ...pw, current: event.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" required hint="At least 8 characters">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pw.next}
                  onChange={(event) => setPw({ ...pw, next: event.target.value })}
                />
              </Field>
              <Field label="Repeat new password" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pw.repeat}
                  onChange={(event) => setPw({ ...pw, repeat: event.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={pwBusy} disabled={!pw.current || !pw.next}>
                Change password
              </Button>
              <Button type="button" variant="ghost" onClick={signOutEverywhere} disabled={pwBusy}>
                Sign out everywhere
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Changing the password signs your other devices out automatically.
            </p>
          </form>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Add a staff account
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cashiers can only sell (POS + Orders). Administrators can also change the catalogue,
            the shop settings and the backups.
          </p>
          <form onSubmit={createAccount} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Username" required>
                <Input
                  value={newUser.username}
                  onChange={(event) => setNewUser({ ...newUser, username: event.target.value })}
                  placeholder="sreyneang"
                  autoComplete="off"
                />
              </Field>
              <Field label="Display name">
                <Input
                  value={newUser.full_name}
                  onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })}
                  placeholder="optional"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Password" required hint="8+ characters, not the username">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newUser.password}
                  onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                />
              </Field>
              <Field label="Role">
                <Select
                  value={newUser.role}
                  onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}
                >
                  <option value="cashier">Cashier — sell only</option>
                  <option value="admin">Administrator — full access</option>
                </Select>
              </Field>
            </div>
            <Button type="submit" loading={creating} disabled={!newUser.username || !newUser.password}>
              Create account
            </Button>
          </form>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Staff accounts
            </h2>
            <p className="text-xs text-slate-400">
              {people.length} account{people.length === 1 ? "" : "s"} — disable a cashier instead of
              deleting it to keep the history readable.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={load} loading={loading}>
            Refresh
          </Button>
        </div>

        {loading && !people.length ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Spinner /> Loading accounts…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Last sign-in</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((account) => {
                  const busy = busyId === account.id;
                  const isMe = !!user && account.id === user.id;
                  return (
                    <tr key={account.id} className={busy ? "opacity-60" : undefined}>
                      <td className="px-4 py-2">
                        <span className="font-semibold text-slate-800">{account.username}</span>
                        {isMe ? (
                          <span className="ml-2 text-[11px] text-brand-600">(you)</span>
                        ) : null}
                        {account.full_name ? (
                          <span className="block text-xs text-slate-400">{account.full_name}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={account.role}
                          disabled={busy}
                          onChange={(event) => changeRole(account, event.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          <option value="cashier">Cashier</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          className={
                            account.is_active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-rose-50 text-rose-700 ring-rose-200"
                          }
                        >
                          {account.is_active ? "active" : "disabled"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {account.last_login_at
                          ? new Date(account.last_login_at).toLocaleString()
                          : "never"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => resetPassword(account)}
                          >
                            Reset password
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => toggleActive(account)}
                          >
                            {account.is_active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy || isMe}
                            onClick={() => removeAccount(account)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Recent activity
            </h2>
            <p className="text-xs text-slate-400">
              Every create / change / delete, plus refused sign-ins and blocked requests.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={load} loading={loading}>
            Refresh
          </Button>
        </div>

        {!audit.length ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing recorded yet.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Who</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">Endpoint</th>
                  <th className="px-4 py-2 text-left">Result</th>
                  <th className="px-4 py-2 text-left">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-1.5 text-xs text-slate-500">
                      {formatStamp(row.at)}
                    </td>
                    <td className="px-4 py-1.5 text-xs">
                      <span className="font-semibold text-slate-700">{row.username}</span>
                      <span className="block text-[11px] text-slate-400">{row.role}</span>
                    </td>
                    <td className="px-4 py-1.5 text-xs text-slate-700">
                      {row.action}
                      {row.detail ? (
                        <span className="block text-[11px] text-slate-400">{row.detail}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-[11px] text-slate-500">
                      {row.method} {row.path}
                    </td>
                    <td className="px-4 py-1.5">
                      <Badge className={statusTone(row.status_code)}>{row.status_code}</Badge>
                    </td>
                    <td className="px-4 py-1.5 font-mono text-[11px] text-slate-500">{row.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
