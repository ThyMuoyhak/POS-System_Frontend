import React, { useCallback, useEffect, useState } from "react";
import api, { ApiError } from "../api";
import { Badge, Button, Checkbox, Field, Input, Select, Spinner } from "../components/ui";
import { timeAgo } from "../utils";
import { useToast } from "../components/Toast";

const CURRENCIES = ["USD", "KHR", "EUR"];

const TEXT_FIELDS = [
  { key: "merchant_name", label: "Merchant name", placeholder: "ABA POS Demo Store" },
  { key: "profile_id", label: "ABA Profile ID", placeholder: "OZqxhAZPSCRXBipq…" },
  {
    key: "api_base",
    label: "ABA API base url",
    placeholder: "https://checkout.payway.com.kh",
  },
  {
    key: "success_url",
    label: "Success / return url",
    placeholder: "http://localhost:3000/?payment=success",
  },
  {
    key: "cancel_url",
    label: "Cancel url",
    placeholder: "http://localhost:3000/?payment=cancel",
  },
  {
    key: "frontend_base_url",
    label: "Frontend base url",
    placeholder: "http://localhost:3000",
    hint: "Where the ABA browser flow sends the customer back.",
  },
];

export default function SettingsPage({ settings, lockedKeys, webhookUrl, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [urls, setUrls] = useState(null);
  const [urlsBusy, setUrlsBusy] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsBusy, setLogsBusy] = useState(false);

  const isLocked = useCallback(
    (key) => (lockedKeys || []).includes(key),
    [lockedKeys]
  );

  useEffect(() => {
    if (!settings) return;
    setForm({
      merchant_name: settings.merchant_name || "",
      currency: settings.currency || "USD",
      profile_id: settings.profile_id || "",
      secret_key: "",
      api_base: settings.api_base || "",
      success_url: settings.success_url || "",
      cancel_url: settings.cancel_url || "",
      frontend_base_url: settings.frontend_base_url || "",
      demo_mode: String(settings.demo_mode ?? "true").toLowerCase() === "true",
      amount_decimals: String(settings.amount_decimals ?? "2"),
    });
  }, [settings]);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  const loadLogs = useCallback(async () => {
    setLogsBusy(true);
    try {
      setLogs(await api.webhookLogs(12));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLogsBusy(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const loadUrls = async () => {
    setUrlsBusy(true);
    try {
      setUrls(await api.abaUrls());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setUrlsBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const payload = { ...form, amount_decimals: Number(form.amount_decimals || 2) };
    // Never send back an empty secret (means "keep the stored value").
    if (!String(payload.secret_key || "").trim()) delete payload.secret_key;
    Object.keys(payload).forEach((key) => {
      if (isLocked(key)) delete payload[key];
    });
    try {
      const result = await api.saveSettings(payload);
      toast.success("Settings saved");
      if (form.secret_key) update({ secret_key: "" });
      onSaved && onSaved(result);
      if (typeof result.settings?.secret_key === "string") {
        setForm((current) => ({ ...current, secret_key: "" }));
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Webhook url copied");
    } catch (err) {
      toast.warning("Clipboard unavailable — copy it manually.");
    }
  };

  /* ===SETTINGS_RENDER=== */
  if (!form) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Spinner /> <span className="ml-2 text-sm">Loading settings…</span>
      </div>
    );
  }

  const renderField = (field) => {
    const locked = isLocked(field.key);
    return (
      <Field
        key={field.key}
        label={field.label}
        hint={locked ? "Locked — set in backend_api/.env" : field.hint}
        className="sm:col-span-2"
      >
        <Input
          value={form[field.key]}
          onChange={(e) => update({ [field.key]: e.target.value })}
          placeholder={field.placeholder}
          disabled={locked}
        />
      </Field>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
          ABA Payway callback (webhook) url
        </p>
        <p className="mt-1 break-all font-mono text-sm text-sky-900">{webhookUrl}</p>
        <p className="mt-1 text-xs text-sky-700">
          Paste this in your ABA Payway merchant portal so ABA can confirm payments automatically.
        </p>
        <Button
          className="mt-2"
          size="sm"
          variant="ghost"
          onClick={() => copy(webhookUrl)}
        >
          Copy webhook url
        </Button>
      </div>

      <form
        onSubmit={save}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"
      >
        <Field label="Merchant name">
          <Input
            value={form.merchant_name}
            onChange={(e) => update({ merchant_name: e.target.value })}
            placeholder="My coffee shop"
          />
        </Field>

        <Field label="Currency" hint="Used for prices and money formatting.">
          <Select
            value={form.currency}
            onChange={(e) => update({ currency: e.target.value })}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Checkbox
            label="Demo mode"
            checked={form.demo_mode}
            disabled={isLocked("demo_mode")}
            onChange={(value) => update({ demo_mode: value })}
            hint="Keeps the manual “Mark as paid” fallback available when ABA cannot reach this machine."
          />
        </div>

        {TEXT_FIELDS.filter((f) => ["profile_id", "api_base"].includes(f.key)).map(
          renderField
        )}

        <Field
          label="ABA Payment secret key"
          className="sm:col-span-2"
          hint={
            isLocked("secret_key")
              ? "Locked — set in backend_api/.env"
              : settings && settings.secret_key
              ? "A secret is already stored (masked). Leave empty to keep it, or type a new one to replace it."
              : "Required for signing hashes. Get it from the ABA Payway merchant portal."
          }
        >
          <Input
            type="password"
            value={form.secret_key}
            placeholder="Leave empty to keep the saved secret"
            disabled={isLocked("secret_key")}
            onChange={(e) => update({ secret_key: e.target.value })}
          />
        </Field>

        {TEXT_FIELDS.filter((f) =>
          ["success_url", "cancel_url", "frontend_base_url"].includes(f.key)
        ).map(renderField)}


        <Field
          label="Amount decimals"
          hint="Digits used in the sha1 hash and sent to ABA. 2 for USD, 0 for KHR."
        >
          <Input
            type="number"
            min="0"
            max="6"
            step="1"
            value={form.amount_decimals}
            onChange={(e) => update({ amount_decimals: e.target.value })}
            disabled={isLocked("amount_decimals")}
          />
        </Field>

        <div className="flex items-end justify-end sm:col-span-2">
          <Button type="submit" loading={saving}>
            Save settings
          </Button>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">
            {error}
          </p>
        ) : null}
      </form>

      {/* ===SETTINGS_DEBUG=== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-700">ABA gateway endpoints</h3>
            {urls ? (
              <Badge
                className={
                  urls.configured
                    ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                    : "bg-rose-100 text-rose-700 ring-rose-200"
                }
              >
                {urls.configured ? "configured" : "not configured"}
              </Badge>
            ) : null}
            <Button
              className="ml-auto"
              size="sm"
              variant="ghost"
              loading={urlsBusy}
              onClick={loadUrls}
            >
              Inspect
            </Button>
          </div>

          {!urls ? (
            <p className="mt-3 text-xs text-slate-400">
              Click “Inspect” to list every endpoint this POS calls, together with the exact hash
              formulas that are signed.
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-xs">
              <div className="space-y-1 font-mono text-[11px] text-slate-600">
                {Object.entries(urls.endpoints || {}).map(([name, url]) => (
                  <p key={name} className="break-all">
                    <span className="font-sans font-semibold text-slate-500">{name}: </span>
                    {url}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-slate-500">
                <span>api base: {urls.api_base}</span>
                <span>decimals: {urls.amount_decimals}</span>
                <span>demo mode: {String(urls.demo_mode)}</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-500">
                {Object.entries(urls.hash_formulas || {}).map(([name, formula]) => (
                  <p key={name} className="break-all">
                    {name} → {formula}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-700">Recent ABA callbacks</h3>
            <Button
              className="ml-auto"
              size="sm"
              variant="ghost"
              loading={logsBusy}
              onClick={loadLogs}
            >
              Refresh
            </Button>
          </div>

          {logs.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">
              No callback received yet. Make a KHQR sale and pay it with the ABA app (or use the
              webhook test tool) and the audit trail will show up here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge
                      className={
                        log.signature_valid
                          ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                          : "bg-amber-100 text-amber-700 ring-amber-200"
                      }
                    >
                      {log.signature_valid ? "signature ok" : "unverified"}
                    </Badge>
                    <span className="font-semibold text-slate-600">{log.source}</span>
                    <span className="text-slate-400">{timeAgo(log.received_at)}</span>
                  </div>
                  <pre className="scroll-thin mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-500">
                    {log.payload}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </div>
  );
}
