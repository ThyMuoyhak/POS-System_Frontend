import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { ALLOW_MANUAL_CONFIRM, ApiError } from "../api";
import { METHOD_STYLES, STATUS_STYLES, formatDateTime, formatMoney } from "../utils";
import { Badge, Button, Checkbox, EmptyState, Field, Input, Select } from "../components/ui";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";

const STATUSES = ["", "PENDING", "PAID", "FAILED", "CANCELLED"];
const METHODS = ["", "CASH", "KHQR"];
const DAY_WINDOWS = [
  { value: "", label: "All time" },
  { value: "1", label: "Today (24h)" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

const money = (currency) => (value) => formatMoney(value, currency);

export default function OrdersPage({ currency, demoMode, onChanged }) {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [days, setDays] = useState("");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const firstLoad = useRef(true);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const rows = await api.listOrders({
          status: status || undefined,
          payment_method: method || undefined,
          search: search.trim() || undefined,
          days: days || undefined,
          limit: 300,
        });
        setOrders(rows);
        setError("");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [status, method, days, search]
  );

  useEffect(() => {
    load(firstLoad.current);
    firstLoad.current = false;
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => load(false), 8000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  const run = async (action, order) => {
    setBusy(`${action}-${order.id}`);
    setNote("");
    try {
      if (action === "check") {
        const result = await api.checkPayment(order.id);
        setSelected(result.order);
        if (result.paid) {
          toast.success(`Order ${order.order_number} is paid ✓`);
          load(false);
          onChanged && onChanged();
        } else {
          setNote(
            `Not paid yet — gateway says: ${result.gateway_message || result.gateway_status || "pending"}`
          );
        }
      } else if (action === "mark") {
        const updated = await api.markPaid(order.id);
        setSelected(updated);
        toast.success(`${updated.order_number} marked as paid`);
        load(false);
        onChanged && onChanged();
      } else if (action === "cancel") {
        const updated = await api.cancelOrder(order.id);
        setSelected(updated);
        toast.info(`${updated.order_number} cancelled`);
        load(false);
        onChanged && onChanged();
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setNote(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch (err) {
      toast.warning("Clipboard unavailable — copy it manually.");
    }
  };

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        const paid = order.status === "PAID";
        if (paid) {
          acc.paid += Number(order.total || 0);
          acc.paidCount += 1;
        }
        if (order.status === "PENDING") {
          acc.pending += 1;
          acc.pendingValue += Number(order.total || 0);
        }
        return acc;
      },
      { paid: 0, paidCount: 0, pending: 0, pendingValue: 0 }
    );
  }, [orders]);

  /* ===ORDERS_RENDER=== */
  const money$ = money(currency || "USD");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Field label="Search" className="w-full sm:w-56">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order or transaction id"
          />
        </Field>
        <Field label="Status" className="w-full sm:w-40">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((value) => (
              <option key={value || "all"} value={value}>
                {value || "All statuses"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Method" className="w-full sm:w-36">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((value) => (
              <option key={value || "all"} value={value}>
                {value || "All methods"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Period" className="w-full sm:w-40">
          <Select value={days} onChange={(e) => setDays(e.target.value)}>
            {DAY_WINDOWS.map((window) => (
              <option key={window.value || "all"} value={window.value}>
                {window.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="pb-1">
          <Checkbox
            label="Auto refresh"
            checked={autoRefresh}
            onChange={setAutoRefresh}
            hint="Polls every 8 seconds"
          />
        </div>
        <Button className="ml-auto" variant="ghost" onClick={() => load(true)} loading={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            Paid in view
          </p>
          <p className="text-lg font-black text-emerald-800">{money$(totals.paid)}</p>
          <p className="text-xs text-emerald-700">{totals.paidCount} order(s)</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
            Pending payment
          </p>
          <p className="text-lg font-black text-amber-800">{money$(totals.pendingValue)}</p>
          <p className="text-xs text-amber-700">{totals.pending} order(s)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Rows loaded
          </p>
          <p className="text-lg font-black text-slate-800">{orders.length}</p>
          <p className="text-xs text-slate-400">max 300 newest first</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          title={loading ? "Loading orders…" : "No order matches these filters"}
          hint="Sell something from the POS tab and it will show up here with its payment status."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="scroll-thin overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Order</th>
                  <th className="px-4 py-2.5 font-bold">Created</th>
                  <th className="px-4 py-2.5 font-bold">Method</th>
                  <th className="px-4 py-2.5 text-center font-bold">Items</th>
                  <th className="px-4 py-2.5 text-right font-bold">Total</th>
                  <th className="px-4 py-2.5 font-bold">Status</th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* ===ORDERS_ROWS=== */}
                {orders.map((order) => (
                  <tr key={order.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-800">{order.order_number}</p>
                      <p className="truncate text-xs text-slate-400">{order.transaction_id}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatDateTime(order.created_at)}
                      {order.paid_at ? (
                        <span className="block text-emerald-600">
                          paid {formatDateTime(order.paid_at)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={METHOD_STYLES[order.payment_method]}>
                        {order.payment_method}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600">
                      {order.item_count}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-bold text-slate-800">
                        {money$(order.total)}
                      </span>
                      {Number(order.discount_total) > 0 ? (
                        <span className="block text-xs text-rose-500">
                          −{money$(order.discount_total)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={STATUS_STYLES[order.status]}>
                        {order.status}
                      </Badge>
                      {order.failure_reason ? (
                        <span className="mt-1 block max-w-[180px] truncate text-xs text-rose-500">
                          {order.failure_reason}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {order.status === "PENDING" && order.payment_method === "KHQR" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={busy === `check-${order.id}`}
                            onClick={() => {
                              setSelected(order);
                              run("check", order);
                            }}
                          >
                            Check
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setNote("");
                            setSelected(order);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===ORDERS_MODAL=== */}
      <Modal
        open={!!selected}
        size="lg"
        title={selected ? `Order ${selected.order_number}` : ""}
        subtitle={selected ? formatDateTime(selected.created_at) : ""}
        onClose={() => {
          setSelected(null);
          setNote("");
        }}
        footer={
          selected ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setNote("");
                }}
              >
                Close
              </Button>
              {selected.status === "PENDING" ? (
                <Button
                  variant="danger"
                  loading={busy === `cancel-${selected.id}`}
                  onClick={() => run("cancel", selected)}
                >
                  Cancel order
                </Button>
              ) : null}
              {selected.status === "PENDING" && selected.payment_method === "KHQR" ? (
                <Button
                  variant="ghost"
                  loading={busy === `check-${selected.id}`}
                  onClick={() => run("check", selected)}
                >
                  Check with ABA
                </Button>
              ) : null}
              {selected.status === "PENDING" && demoMode && ALLOW_MANUAL_CONFIRM ? (
                <Button
                  variant="success"
                  loading={busy === `mark-${selected.id}`}
                  onClick={() => run("mark", selected)}
                >
                  Mark as paid
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_STYLES[selected.status]}>{selected.status}</Badge>
              <Badge className={METHOD_STYLES[selected.payment_method]}>
                {selected.payment_method}
              </Badge>
              {selected.paid_at ? (
                <span className="text-xs text-emerald-600">
                  Paid {formatDateTime(selected.paid_at)}
                </span>
              ) : null}
              <Button
                size="sm"
                variant="subtle"
                className="ml-auto"
                onClick={() => copy(selected.transaction_id, "Transaction id")}
              >
                Copy transaction id
              </Button>
            </div>

            <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Transaction ID</dt>
                <dd className="truncate font-mono text-xs text-slate-700">
                  {selected.transaction_id}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Currency</dt>
                <dd className="font-semibold text-slate-700">{selected.currency}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Amount paid</dt>
                <dd className="font-semibold text-slate-700">
                  {money$(selected.amount_paid)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Change</dt>
                <dd className="font-semibold text-slate-700">
                  {money$(selected.change_amount)}
                </dd>
              </div>
            </dl>

            {/* ===ORDERS_ITEMS=== */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-bold">Item</th>
                    <th className="px-3 py-2 text-right font-bold">Unit</th>
                    <th className="px-3 py-2 text-center font-bold">Qty</th>
                    <th className="px-3 py-2 text-right font-bold">Line</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selected.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-700">{item.title}</p>
                        {Number(item.discount) > 0 ? (
                          <p className="text-xs text-rose-500">-{item.discount}% discount</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {money$(item.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {money$(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 text-sm">
                  <tr>
                    <td className="px-3 py-2 text-slate-500" colSpan={3}>
                      Subtotal
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {money$(selected.subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-500" colSpan={3}>
                      Discount
                    </td>
                    <td className="px-3 py-2 text-right text-rose-600">
                      −{money$(selected.discount_total)}
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td className="px-3 py-2 text-slate-700" colSpan={3}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right text-brand-700">
                      {money$(selected.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selected.customer_note ? (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <span className="font-semibold">Note: </span>
                {selected.customer_note}
              </p>
            ) : null}

            {selected.failure_reason ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <span className="font-semibold">Gateway: </span>
                {selected.failure_reason}
              </p>
            ) : null}

            {note ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {note}
              </p>
            ) : null}

            {/* ===ORDERS_KHQR=== */}
            {selected.qr_string || selected.qr_url || selected.checkout_url ? (
              <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                  ABA KHQR data
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.qr_string ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(selected.qr_string, "QR string")}
                    >
                      Copy raw QR string
                    </Button>
                  ) : null}
                  {selected.qr_url ? (
                    <a
                      href={selected.qr_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                    >
                      Open QR image ↗
                    </a>
                  ) : null}
                  {selected.checkout_url ? (
                    <a
                      href={selected.checkout_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                    >
                      Open hosted checkout ↗
                    </a>
                  ) : null}
                </div>
                {selected.qr_string ? (
                  <pre className="scroll-thin max-h-24 overflow-auto rounded-lg bg-white p-2 text-[10px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
                    {selected.qr_string}
                  </pre>
                ) : null}
                {selected.status === "PENDING" ? (
                  <p className="text-xs text-indigo-700">
                    Waiting for the customer to scan. The order settles automatically when the ABA
                    webhook arrives, or press “Check with ABA” to poll the gateway now.
                  </p>
                ) : null}
              </div>
            ) : selected.status === "PENDING" && selected.payment_method === "KHQR" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No KHQR was generated for this order (gateway unreachable or credentials missing).
                Configure ABA Payway in Settings and create the sale again, or confirm it manually.
              </p>
            ) : null}


          </div>
        ) : null}
      </Modal>

    </div>
  );
}
