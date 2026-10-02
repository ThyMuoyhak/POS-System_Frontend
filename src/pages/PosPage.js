import React, { useMemo, useState } from "react";
import { formatMoney, classNames } from "../utils";
import { Badge, Button, EmptyState, Input, Select, Spinner, Thumb } from "../components/ui";
import PaymentModal from "../components/PaymentModal";
import { useToast } from "../components/Toast";

const QUICK_DISCOUNTS = [0, 5, 10, 15, 20];

export default function PosPage({
  currency,
  demoMode,
  categories,
  products,
  loading,
  onReload,
  onSale,
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payTab, setPayTab] = useState("CASH");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && String(product.category_id || "") !== String(categoryId)) {
        return false;
      }
      if (onlyInStock && Number(product.stock) <= 0) return false;
      if (!term) return true;
      return (
        product.title.toLowerCase().includes(term) ||
        String(product.sku || "").toLowerCase().includes(term) ||
        String(product.description || "").toLowerCase().includes(term)
      );
    });
  }, [products, search, categoryId, onlyInStock]);

  const addToCart = (product) => {
    if (!product.is_active) {
      toast.warning(`"${product.title}" is disabled.`);
      return;
    }
    if (Number(product.stock) <= 0) {
      toast.warning(`"${product.title}" is out of stock.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.product_id === product.id);
      if (existing) {
        if (existing.quantity + 1 > Number(product.stock)) {
          toast.warning(`Only ${product.stock} × "${product.title}" in stock.`);
          return current;
        }
        return current.map((line) =>
          line.product_id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          title: product.title,
          image_url: product.image_url,
          unit_price: Number(product.price || 0),
          discount: Number(product.discount || 0),
          quantity: 1,
          stock: Number(product.stock || 0),
        },
      ];
    });
  };

  const setQuantity = (productId, quantity) =>
    setCart((current) =>
      current
        .map((line) => {
          if (line.product_id !== productId) return line;
          const next = Math.max(0, Math.min(quantity, line.stock));
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0)
    );

  const setLineDiscount = (productId, discount) =>
    setCart((current) =>
      current.map((line) =>
        line.product_id === productId ? { ...line, discount: Number(discount) } : line
      )
    );

  const removeLine = (productId) =>
    setCart((current) => current.filter((line) => line.product_id !== productId));

  const clearCart = () => {
    setCart([]);
    setNote("");
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    cart.forEach((line) => {
      const gross = line.unit_price * line.quantity;
      subtotal += gross;
      discountTotal += gross * (Number(line.discount || 0) / 100);
    });
    return {
      subtotal,
      discountTotal,
      total: Math.max(0, subtotal - discountTotal),
      units: cart.reduce((sum, line) => sum + line.quantity, 0),
    };
  }, [cart]);

  const paymentItems = cart.map((line) => ({
    product_id: line.product_id,
    quantity: line.quantity,
    discount: Number(line.discount) || 0,
  }));

  /** Open the payment modal straight on the method the cashier pressed. */
  const openPayment = (method) => {
    setPayTab(method);
    setPayOpen(true);
  };

  const handleSuccess = (order, message) => {
    setPayOpen(false);
    setPayTab("CASH");
    clearCart();
    toast.success(message || `Order ${order.order_number} completed`);
    onSale();
    if (onReload) onReload();
  };

  /* ===POS_RENDER=== */
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, SKU or description…"
            className="sm:max-w-xs"
          />
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="sm:max-w-[200px]"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={onlyInStock}
              onChange={(e) => setOnlyInStock(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            In stock only
          </label>
          <span className="ml-auto text-xs text-slate-400">
            {loading ? "Loading…" : `${visible.length} product(s)`}
          </span>
        </div>

        {loading && !products.length ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No products match your filters"
            hint="Add products from the Products page, or clear the search and category filters."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductTile
                key={product.id}
                product={product}
                currency={currency}
                onAdd={() => addToCart(product)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===POS_ASIDE=== */}
      <aside className="flex h-fit flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Current sale
          </h2>
          {cart.length ? (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Clear
            </button>
          ) : null}
        </header>

        {cart.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
            Tap a product to add it to the basket.
          </p>
        ) : (
          <ul className="scroll-thin -mx-1 max-h-[45vh] space-y-2 overflow-y-auto px-1">
            {cart.map((line) => (
              <li key={line.product_id} className="rounded-lg bg-slate-50 p-2">
                <div className="flex items-start gap-2">
                  <Thumb
                    src={line.image_url}
                    title={line.title}
                    className="h-10 w-10 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {line.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatMoney(line.unit_price, currency)}
                      {Number(line.discount) > 0 ? (
                        <span className="ml-1 text-rose-600">-{line.discount}%</span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.product_id)}
                    className="text-slate-400 transition hover:text-rose-600"
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center rounded-lg bg-white ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.product_id, line.quantity - 1)}
                      className="px-2 py-1 text-sm font-bold text-slate-500 hover:text-brand-700"
                    >
                      −
                    </button>
                    <input
                      value={line.quantity}
                      onChange={(e) =>
                        setQuantity(
                          line.product_id,
                          Number(String(e.target.value).replace(/\D/g, "")) || 0
                        )
                      }
                      className="w-10 border-0 bg-transparent text-center text-sm font-semibold text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(line.product_id, line.quantity + 1)}
                      className="px-2 py-1 text-sm font-bold text-slate-500 hover:text-brand-700"
                    >
                      +
                    </button>
                  </div>

                  <select
                    value={line.discount}
                    onChange={(e) => setLineDiscount(line.product_id, e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                  >
                    {QUICK_DISCOUNTS.map((value) => (
                      <option key={value} value={value}>
                        -{value}%
                      </option>
                    ))}
                  </select>

                  <span className="ml-auto text-sm font-bold text-slate-800">
                    {formatMoney(
                      line.unit_price * (1 - Number(line.discount) / 100) * line.quantity,
                      currency
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ===POS_TOTALS=== */}
        <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-3">
          <SummaryRow label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
          {totals.discountTotal > 0 ? (
            <SummaryRow
              label="Discount"
              value={`- ${formatMoney(totals.discountTotal, currency)}`}
              tone="text-rose-600"
            />
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-sm font-bold text-slate-600">Total</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {formatMoney(totals.total, currency)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {totals.units} unit(s) in the basket
          </p>
        </div>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the customer (optional)"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="lg"
            disabled={!cart.length}
            onClick={() => openPayment("CASH")}
          >
            💵 Cash
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!cart.length}
            onClick={() => openPayment("KHQR")}
          >
            📱 KHQR
          </Button>
        </div>
        {cart.length ? (
          <p className="text-center text-[11px] text-slate-400">
            KHQR shows a scan-to-pay QR code — the order settles automatically.
          </p>
        ) : null}

        {demoMode ? (
          <div className="flex justify-center">
            <Badge className="bg-amber-100 text-amber-700 ring-amber-200">
              demo mode · manual confirm allowed
            </Badge>
          </div>
        ) : null}
      </aside>

      <PaymentModal
        open={payOpen}
        total={totals.total}
        currency={currency}
        items={paymentItems}
        customerNote={note}
        demoMode={demoMode}
        initialTab={payTab}
        autoStart={payTab === "KHQR"}
        onClose={() => setPayOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- sub views */

function SummaryRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={classNames("font-semibold", tone || "text-slate-700")}>
        {value}
      </span>
    </div>
  );
}

/* ===POS_TILE=== */
function ProductTile({ product, currency, onAdd }) {
  const finalPrice = Number(product.final_price ?? product.price ?? 0);
  const hasDiscount = Number(product.discount || 0) > 0;
  const out = Number(product.stock || 0) <= 0;
  const disabled = out || !product.is_active;

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className={classNames(
        "group flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition",
        disabled
          ? "cursor-not-allowed border-slate-200 opacity-60"
          : "border-slate-200 hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
      )}
    >
      <Thumb src={product.image_url} title={product.title} className="h-28 w-full text-lg" />
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold text-slate-800">
          {product.title}
        </p>
        <p className="text-[11px] text-slate-400">
          {product.category_name || "Uncategorised"}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <span>
            {hasDiscount ? (
              <span className="mr-1 text-xs text-slate-400 line-through">
                {formatMoney(product.price, currency)}
              </span>
            ) : null}
            <span className="text-sm font-bold text-brand-700">
              {formatMoney(finalPrice, currency)}
            </span>
          </span>
          <Badge
            className={
              out
                ? "bg-rose-100 text-rose-700 ring-rose-200"
                : "bg-emerald-100 text-emerald-700 ring-emerald-200"
            }
          >
            {out ? "Out" : product.stock}
          </Badge>
        </div>
      </div>
    </button>
  );
}
