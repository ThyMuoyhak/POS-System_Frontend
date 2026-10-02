import React, { useRef, useState } from "react";
import api, { ApiError, downloadBackup, readJsonFile } from "../api";
import { Badge, Button, Field, Input } from "../components/ui";
import { ConfirmDialog } from "../components/Modal";
import { useToast } from "../components/Toast";

export default function DataPage({ stats, onReload }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [pending, setPending] = useState(null); // { name, data }
  const [mode, setMode] = useState("merge");
  const [askImport, setAskImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetText, setResetText] = useState("");
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const filename = await downloadBackup();
      toast.success(`Backup downloaded: ${filename}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  const pickFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setLastResult(null);
    try {
      const data = await readJsonFile(file);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("That file is not an ABA POS backup (expected a JSON object).");
      }
      setPending({ name: file.name, data });
    } catch (err) {
      setError(err.message || String(err));
      toast.error(err.message || String(err));
    }
  };

  const runImport = async () => {
    if (!pending) return;
    setImporting(true);
    setError("");
    try {
      const result = await api.importData(pending.data, mode);
      const importStats = result.stats || {};
      setLastResult({ filename: pending.name, mode, stats: importStats });
      toast.success(`Import complete (${mode})`);
      setAskImport(false);
      setPending(null);
      onReload && onReload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const runReset = async () => {
    setResetting(true);
    setError("");
    try {
      await api.resetData("RESET");
      toast.success("All products, categories and orders were removed");
      setAskReset(false);
      setResetText("");
      setLastResult(null);
      onReload && onReload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setResetting(false);
    }
  };

  /* ===DATA_RENDER=== */
  const counts = pending && pending.data ? pending.data.counts || {} : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Products", value: stats ? stats.products : "—" },
          { label: "Categories", value: stats ? stats.categories : "—" },
          { label: "Orders today", value: stats ? stats.orders_today : "—" },
          { label: "Pending", value: stats ? stats.pending_orders : "—" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className="text-lg font-black text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700">1 · Download a backup</h3>
          <p className="mt-1 text-xs text-slate-500">
            Exports settings, categories, products and every order (with line items) into a single
            JSON file. Keep it somewhere safe — it is also your restore point.
          </p>
          <Button
            className="mt-3 self-start"
            loading={downloading}
            onClick={handleDownload}
          >
            Download JSON backup
          </Button>
        </div>

        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700">2 · Restore / import</h3>
          <p className="mt-1 text-xs text-slate-500">
            Pick a backup file created by this POS. <strong>Merge</strong> adds what is missing,
            <strong> replace</strong> wipes products, categories and orders first.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={pickFile}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => fileInput.current && fileInput.current.click()}>
              Choose backup file…
            </Button>
            {pending ? (
              <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                {pending.name}
              </Badge>
            ) : null}
          </div>

          {/* ===DATA_IMPORT_PREVIEW=== */}
          {pending ? (
            <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 text-xs">
              <div className="grid gap-1 sm:grid-cols-2">
                <p className="text-slate-500">
                  app: <span className="font-semibold text-slate-700">
                    {(pending.data && pending.data.app) || "unknown"}
                  </span>
                </p>
                <p className="text-slate-500">
                  version: <span className="font-semibold text-slate-700">
                    {(pending.data && pending.data.version) || "—"}
                  </span>
                </p>
                <p className="text-slate-500 sm:col-span-2">
                  exported at: <span className="font-semibold text-slate-700">
                    {(pending.data && pending.data.exported_at) || "—"}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className="bg-white text-slate-600 ring-slate-200">
                  {(counts && counts.categories) ?? (pending.data.categories || []).length} categories
                </Badge>
                <Badge className="bg-white text-slate-600 ring-slate-200">
                  {(counts && counts.products) ?? (pending.data.products || []).length} products
                </Badge>
                <Badge className="bg-white text-slate-600 ring-slate-200">
                  {(counts && counts.orders) ?? (pending.data.orders || []).length} orders
                </Badge>
              </div>

              <div className="space-y-1">
                {[
                  { value: "merge", label: "Merge — add missing rows, keep existing data" },
                  { value: "replace", label: "Replace — wipe products, categories and orders first" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-slate-600"
                  >
                    <input
                      type="radio"
                      name="import-mode"
                      value={option.value}
                      checked={mode === option.value}
                      onChange={() => setMode(option.value)}
                      className="h-3.5 w-3.5 border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={mode === "replace" ? "danger" : "primary"}
                  onClick={() => setAskImport(true)}
                >
                  {mode === "replace" ? "Replace everything & import" : "Merge import"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPending(null);
                    setError("");
                  }}
                >
                  Clear file
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No file selected yet.</p>
          )}

        </div>
      </div>

      {/* ===DATA_RESULT=== */}
      {lastResult ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-bold">
            Last import: {lastResult.filename} ({lastResult.mode})
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(lastResult.stats || {}).map(([key, value]) => (
              <Badge key={key} className="bg-white text-emerald-700 ring-emerald-200">
                {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {/* ===DATA_DANGER=== */}
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h3 className="text-sm font-bold text-rose-800">3 · Danger zone</h3>
        <p className="mt-1 text-xs text-rose-700">
          Deletes every product, category and order (settings are kept). Download a backup first —
          this cannot be undone.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Type RESET to unlock" className="w-full sm:w-56">
            <Input
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              placeholder="RESET"
            />
          </Field>
          <Button
            variant="danger"
            disabled={resetText.trim().toUpperCase() !== "RESET"}
            onClick={() => setAskReset(true)}
          >
            Delete all data
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={askImport && !!pending}
        title={mode === "replace" ? "Replace the whole database?" : "Merge this backup?"}
        message={
          pending
            ? mode === "replace"
              ? `Every product, category and order will be deleted, then "${pending.name}" will be imported. Download a backup of the current data first if you are unsure.`
              : `Rows from "${pending.name}" that are missing locally will be added. Existing products, categories and orders are left untouched.`
            : ""
        }
        confirmLabel={mode === "replace" ? "Yes, replace everything" : "Yes, merge import"}
        danger={mode === "replace"}
        busy={importing}
        onCancel={() => setAskImport(false)}
        onConfirm={runImport}
      />

      <ConfirmDialog
        open={askReset}
        title="Delete all data"
        message="All products, categories and orders will be permanently removed. Settings stay. This cannot be undone."
        confirmLabel="Delete everything"
        busy={resetting}
        onCancel={() => setAskReset(false)}
        onConfirm={runReset}
      />

    </div>
  );
}
