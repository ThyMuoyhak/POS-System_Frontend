import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { ApiError, ALLOW_MANUAL_CONFIRM } from "../api";
import { classNames, formatMoney } from "../utils";
import { Badge, Button, Field, Input } from "./ui";
import Modal from "./Modal";

const POLL_INTERVAL_MS = 3500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/* KHQR is settled with the QR code shown inside this modal: no ABA iframe and no
   hosted checkout window is ever opened. The customer scans the code with a KHQR
   banking app and the POS picks the payment up by polling ABA Payway. */

/** Build an <img> src for the raw KHQR string when the gateway returns no PNG. */
function fallbackQrImage(qrString) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=340x340&margin=10&data=${encodeURIComponent(
    qrString
  )}`;
}

export default function PaymentModal({
  open,
  total,
  currency = "USD",
  items = [],
  customerNote = "",
  demoMode = false,
  initialTab = "CASH",
  autoStart = false,
  onClose,
  onSuccess,
}) {
  const [tab, setTab] = useState(initialTab === "KHQR" ? "KHQR" : "CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  const [khqr, setKhqr] = useState(null); // OrderCreateResult payload
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [gatewayMessage, setGatewayMessage] = useState("");
  const startedAt = useRef(0);
  const autoStartedRef = useRef(false); // one auto-Generate per modal open

  const manualAllowed = ALLOW_MANUAL_CONFIRM && demoMode;
  const change = Math.max(0, Number(amountPaid || 0) - Number(total || 0));
  const enoughCash = Number(amountPaid || 0) >= Number(total || 0);

  const quickAmounts = useMemo(() => {
    const value = Number(total || 0);
    const unit = currency === "KHR" ? 1000 : 1;
    const candidates = [
      value,
      Math.ceil(value / unit) * unit,
      Math.ceil(value / (unit * 5)) * (unit * 5),
      Math.ceil(value / (unit * 10)) * (unit * 10),
      Math.ceil(value / (unit * 20)) * (unit * 20),
    ];
    return [...new Set(candidates.filter((n) => n > 0))].slice(0, 5);
  }, [total, currency]);

  const reset = useCallback(
    (nextTab = "CASH") => {
      setTab(nextTab === "KHQR" ? "KHQR" : "CASH");
      setBusy(false);
      setError("");
      setAmountPaid("");
      setKhqr(null);
      setPolling(false);
      setPollCount(0);
      setGatewayMessage("");
      startedAt.current = 0;
    },
    []
  );

  useEffect(() => {
    if (!open) {
      reset("CASH");
      // a fresh open may auto-create a QR
      autoStartedRef.current = false;
      return;
    }
    reset(initialTab);
  }, [open, initialTab, reset]);

  /* ----------------------------------------------------------- cash settle */
  const payCash = async () => {
    if (!enoughCash) {
      setError("Cash received is less than the total.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const order = await api.createOrder({
        payment_method: "CASH",
        items,
        customer_note: customerNote || null,
        amount_paid: Number(amountPaid || total),
      });
      onSuccess(order, `Cash sale ${order.order_number} completed`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ KHQR flow */
  const checkNow = useCallback(
    async (quiet = true) => {
      if (!khqr) return;
      try {
        const result = await api.checkPayment(khqr.order.id);
        setGatewayMessage(result.gateway_message || result.gateway_status || "");
        if (result.paid) {
          setPolling(false);
          onSuccess(
            result.order,
            `KHQR payment received for ${result.order.order_number}`
          );
        }
      } catch (err) {
        if (!quiet) setError(err instanceof ApiError ? err.message : String(err));
      }
    },
    [khqr, onSuccess]
  );

  const startKhqr = useCallback(async () => {
    if (!items.length) {
      setError("Add at least one product to the basket before taking a KHQR payment.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.createOrder({
        payment_method: "KHQR",
        items,
        customer_note: customerNote || null,
      });
      startedAt.current = Date.now();
      setPollCount(0);
      setGatewayMessage(result.gateway_message || "");
      setKhqr(result);
      setPolling(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [items, customerNote]);

  // poll ABA while a QR is on screen (stops when paid, cancelled or timed out)
  useEffect(() => {
    if (!polling || !khqr) return undefined;
    const id = setInterval(() => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setPolling(false);
        setGatewayMessage(
          (current) => current || "Timed out waiting for the payment."
        );
        return;
      }
      setPollCount((c) => c + 1);
      checkNow(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [polling, khqr, checkNow]);

  // opened from the POS "KHQR" button: create the QR order without pressing Generate
  useEffect(() => {
    if (!open || !autoStart) return;
    if (tab !== "KHQR" || khqr || busy || autoStartedRef.current) return;
    if (!items.length) return;
    autoStartedRef.current = true;
    startKhqr();
  }, [open, autoStart, tab, khqr, busy, items.length, startKhqr]);

  const markPaidManually = async () => {
    if (!khqr) return;
    setBusy(true);
    setError("");
    try {
      const order = await api.markPaid(khqr.order.id);
      onSuccess(order, `Order ${order.order_number} marked as paid`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (khqr) {
      try {
        await api.cancelOrder(khqr.order.id);
      } catch (err) {
        /* may already be paid - ignore */
      }
    }
    reset();
    onClose();
  };

  const qrImage =
    khqr && (khqr.qr_url || (khqr.qr_string ? fallbackQrImage(khqr.qr_string) : ""));

  /* ===RENDER=== */
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Take payment"
      subtitle={`Amount due ${formatMoney(total, currency)} · ${items.length} line(s)`}
      footer={
        tab === "CASH" ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={payCash}
              loading={busy}
              disabled={!enoughCash}
            >
              Complete cash sale
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={cancelOrder} disabled={busy}>
              {khqr ? "Cancel order" : "Close"}
            </Button>
            {!khqr ? (
              <Button onClick={startKhqr} loading={busy} disabled={!items.length}>
                Generate KHQR
              </Button>
            ) : (
              <>
                <Button variant="primary" onClick={() => checkNow(false)} loading={busy}>
                  Check payment now
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <PaymentTabs tab={tab} setTab={setTab} />

      {error ? (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {tab === "CASH" ? (
        <CashPanel
          total={total}
          currency={currency}
          amountPaid={amountPaid}
          setAmountPaid={setAmountPaid}
          change={change}
          quickAmounts={quickAmounts}
        />
      ) : (
        <KhqrPanel
          khqr={khqr}
          qrImage={qrImage}
          currency={currency}
          polling={polling}
          pollCount={pollCount}
          gatewayMessage={gatewayMessage}
          manualAllowed={manualAllowed}
          busy={busy}
          onMarkPaid={markPaidManually}
          onRetry={startKhqr}
        />
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------- sub views */

function PaymentTabs({ tab, setTab }) {
  const items = [
    { id: "CASH", label: "💵 Cash", hint: "Instant" },
    { id: "KHQR", label: "📱 ABA KHQR", hint: "Scan to pay" },
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setTab(item.id)}
          className={classNames(
            "rounded-lg px-3 py-2 text-sm font-semibold transition",
            tab === item.id
              ? "bg-white text-brand-700 shadow"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {item.label}
          <span className="ml-2 hidden text-[11px] font-normal text-slate-400 sm:inline">
            {item.hint}
          </span>
        </button>
      ))}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function CashPanel({
  total,
  currency,
  amountPaid,
  setAmountPaid,
  change,
  quickAmounts,
}) {
  const append = (char) => {
    setAmountPaid((current) => {
      if (char === "." && current.includes(".")) return current;
      const next = `${current}${char}`;
      const decimals = next.split(".")[1];
      if (decimals && decimals.length > 2) return current;
      return next.replace(/^0(?=\d)/, "");
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Field label="Cash received" required>
          <Input
            autoFocus
            type="number"
            min="0"
            step={currency === "KHR" ? "100" : "0.01"}
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0"
            className="text-right text-lg font-bold"
          />
        </Field>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setAmountPaid(String(amount))}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              {formatMoney(amount, currency)}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => append(key)}
              className="rounded-lg bg-white py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmountPaid((c) => c.slice(0, -1))}
            className="rounded-lg bg-rose-50 py-2 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100"
          >
            ⌫
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <Row label="Amount due" value={formatMoney(total, currency)} />
        <Row label="Cash received" value={formatMoney(amountPaid || 0, currency)} />
        <div className="my-2 border-t border-dashed border-slate-300" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">Change</span>
          <span className="text-xl font-bold text-emerald-600">
            {formatMoney(change, currency)}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          The sale is stored instantly and stock is deducted.
        </p>
      </div>
    </div>
  );
}

function KhqrPanel({
  khqr,
  qrImage,
  currency,
  polling,
  pollCount,
  gatewayMessage,
  manualAllowed,
  busy,
  onMarkPaid,
  onRetry,
}) {
  if (!khqr) {
    return (
      <div className="rounded-xl bg-slate-50 p-6 text-center ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-700">
          Press <span className="text-brand-700">Generate KHQR</span> to create a
          dynamic ABA Payway QR for this basket.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          The QR code then appears here — the customer scans it and the POS settles
          the order automatically.
        </p>
      </div>
    );
  }

  const order = khqr.order;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        {qrImage ? (
          <img
            src={qrImage}
            alt="KHQR code"
            className="h-64 w-64 rounded-lg bg-white p-2 shadow-sm"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-white p-4 text-center text-xs text-slate-400 shadow-sm">
            No QR image returned by the gateway.
          </div>
        )}
        <p className="text-center text-sm font-bold text-slate-700">
          {formatMoney(order.total, currency)}
        </p>
        <p className="text-center text-xs text-slate-500">
          Ask the customer to scan with any KHQR supported banking app.
        </p>
      </div>

      <div className="space-y-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <Row label="Order" value={order.order_number} />
          <Row label="Transaction ID" value={order.transaction_id} />
          <Row label="Total" value={formatMoney(order.total, currency)} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-slate-500">Status</span>
            <Badge
              className={
                polling
                  ? "bg-amber-100 text-amber-700 ring-amber-200"
                  : "bg-slate-100 text-slate-600 ring-slate-200"
              }
            >
              {polling ? `Waiting (${pollCount})` : order.status}
            </Badge>
          </div>
        </div>

        {gatewayMessage ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
            {gatewayMessage}
          </p>
        ) : null}

        {khqr.gateway_ok === false ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The gateway did not return a QR code for this order. Check the Profile ID
            and Payment Secret in{" "}
            <span className="font-semibold">Settings</span>, then press “New QR” to
            try again.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {manualAllowed ? (
            <Button variant="success" size="sm" onClick={onMarkPaid} loading={busy}>
              Mark as paid (demo)
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onRetry} disabled={busy}>
            New QR
          </Button>
        </div>

        {manualAllowed ? (
          <p className="text-[11px] text-slate-400">
            Demo mode is on: manual confirmation lets you test the full flow without
            a live ABA account.
          </p>
        ) : null}
      </div>
    </div>
  );
}
