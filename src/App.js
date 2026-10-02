import React, { useCallback, useEffect, useState } from "react";
import api, { ALLOW_MANUAL_CONFIRM, API_BASE, ApiError } from "./api";
import { clearSession, getToken, getUser, isAdmin, subscribeToSession } from "./auth";
import { formatMoney } from "./utils";
import { Badge, Button, Spinner } from "./components/ui";
import { ToastProvider, useToast } from "./components/Toast";
import PosPage from "./pages/PosPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import OrdersPage from "./pages/OrdersPage";
import SettingsPage from "./pages/SettingsPage";
import DataPage from "./pages/DataPage";
import SecurityPage from "./pages/SecurityPage";
import LoginPage from "./pages/LoginPage";

/**
 * `adminOnly` tabs are the ones a cashier must not use (the API answers 403 for
 * every call behind them). Hiding them here is only cosmetic - the backend is
 * the real gate.
 */
const TABS = [
  { id: "pos", label: "POS", hint: "Sell & take payment" },
  { id: "orders", label: "Orders", hint: "History & payment status" },
  { id: "products", label: "Products", hint: "Catalogue", adminOnly: true },
  { id: "categories", label: "Categories", hint: "Grouping", adminOnly: true },
  { id: "settings", label: "Settings", hint: "ABA Payway & shop", adminOnly: true },
  { id: "data", label: "Backup", hint: "Export / import / reset", adminOnly: true },
  { id: "security", label: "Security", hint: "Users, roles & audit log", adminOnly: true },
];

function Shell({ user, onSignOut }) {
  const toast = useToast();
  const [tab, setTab] = useState("pos");
  const admin = isAdmin(user);
  const tabs = TABS.filter((item) => !item.adminOnly || admin);
  const [settings, setSettings] = useState(null);
  const [lockedKeys, setLockedKeys] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const currency = (settings && settings.currency) || "USD";
  const demoMode = String((settings && settings.demo_mode) || "false").toLowerCase() === "true";
  const merchantName = (settings && settings.merchant_name) || "ABA POS";

  const loadCatalogue = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [cats, prods, stat] = await Promise.all([
        api.listCategories(),
        api.listProducts(),
        api.stats(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setStats(stat);
      setOffline(false);
    } catch (err) {
      setOffline(true);
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.stats());
      setOffline(false);
    } catch (err) {
      setOffline(true);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const result = await api.getSettings();
      setSettings(result.settings || {});
      setLockedKeys(result.locked_keys || []);
      setWebhookUrl(result.webhook_url || "");
      setOffline(false);
      return result;
    } catch (err) {
      setOffline(true);
      toast.error(err instanceof ApiError ? err.message : String(err));
      return null;
    }
  }, [toast]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadCatalogue(true), loadSettings()]);
  }, [loadCatalogue, loadSettings]);

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => loadStats(), 20000);
    return () => clearInterval(timer);
  }, [loadStats]);

  // A cashier (or a demoted account) must not stay on a page it cannot use.
  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) setTab("pos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, tab]);

  // ABA returns the customer here: /?payment=success|pending&order=...&order_id=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (!payment) return;
    const orderNumber = params.get("order");
    if (payment === "success") {
      toast.success(`Payment confirmed${orderNumber ? ` for ${orderNumber}` : ""} ✓`);
    } else if (payment === "cancel") {
      toast.warning(`Payment cancelled${orderNumber ? ` (${orderNumber})` : ""}`);
    } else {
      toast.info(`Payment is still pending${orderNumber ? ` (${orderNumber})` : ""}`);
    }
    setTab("orders");
    loadCatalogue(false);
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===APP_RENDER=== */
  const chips = [
    {
      label: "Today",
      value: stats ? formatMoney(stats.sales_today, currency) : "—",
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    },
    {
      label: "Orders",
      value: stats ? stats.orders_today : "—",
      tone: "text-slate-700 bg-slate-100 ring-slate-200",
    },
    {
      label: "Cash",
      value: stats ? formatMoney(stats.cash_today, currency) : "—",
      tone: "text-sky-700 bg-sky-50 ring-sky-200",
    },
    {
      label: "KHQR",
      value: stats ? formatMoney(stats.khqr_today, currency) : "—",
      tone: "text-indigo-700 bg-indigo-50 ring-indigo-200",
    },
    {
      label: "Pending",
      value: stats ? stats.pending_orders : "—",
      tone: "text-amber-700 bg-amber-50 ring-amber-200",
    },
    {
      label: "Low stock",
      value: stats ? stats.low_stock : "—",
      tone: "text-rose-700 bg-rose-50 ring-rose-200",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      {offline ? (
        <div className="bg-rose-600 px-4 py-2 text-center text-xs font-semibold text-white">
          Cannot reach the API at {API_BASE}. Start it with{" "}
          <code className="rounded bg-rose-700 px-1">uvicorn main:app --reload</code> inside
          backend_api, then press Reload.
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white">
            ₳
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-slate-800">
              {merchantName}
            </h1>
            <p className="text-xs text-slate-400">
              Cash &amp; ABA Payway KHQR · prices in {currency}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded-lg px-2 py-1 text-center ring-1 ${chip.tone}`}
              >
                <span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">
                  {chip.label}
                </span>
                <span className="block text-xs font-bold">{chip.value}</span>
              </span>
            ))}
            {demoMode && ALLOW_MANUAL_CONFIRM ? (
              <Badge className="bg-amber-100 text-amber-700 ring-amber-200">demo</Badge>
            ) : null}
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {user ? user.username : ""}
              <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {admin ? "admin" : "cashier"}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={reloadAll} loading={loading}>
              Reload
            </Button>
            <Button size="sm" variant="ghost" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>

        <nav className="scroll-thin mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              title={item.hint}
              className={
                tab === item.id
                  ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm"
                  : "rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {tab === "pos" ? (
          <PosPage
            currency={currency}
            demoMode={demoMode}
            categories={categories}
            products={products}
            loading={loading}
            onReload={() => loadCatalogue(false)}
            onSale={loadStats}
          />
        ) : null}

        {tab === "products" ? (
          <ProductsPage
            products={products}
            categories={categories}
            currency={currency}
            loading={loading}
            onReload={() => loadCatalogue(false)}
          />
        ) : null}

        {tab === "categories" ? (
          <CategoriesPage
            categories={categories}
            products={products}
            loading={loading}
            onReload={() => loadCatalogue(false)}
          />
        ) : null}

        {/* ===APP_TABS=== */}
        {tab === "orders" ? (
          <OrdersPage currency={currency} demoMode={demoMode} onChanged={loadStats} />
        ) : null}

        {tab === "settings" ? (
          <SettingsPage
            settings={settings}
            lockedKeys={lockedKeys}
            webhookUrl={webhookUrl}
            onSaved={(result) => {
              if (result && result.settings) setSettings(result.settings);
              if (result && result.locked_keys) setLockedKeys(result.locked_keys);
              if (result && result.webhook_url) setWebhookUrl(result.webhook_url);
              loadStats();
            }}
          />
        ) : null}

        {tab === "data" ? (
          <DataPage stats={stats} onReload={reloadAll} />
        ) : null}

        {tab === "security" && admin ? <SecurityPage user={user} /> : null}

        {tab !== "pos" && tab !== "products" && tab !== "categories" && tab !== "orders" &&
        tab !== "settings" && tab !== "data" && tab !== "security" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <Spinner className="mx-auto mb-3" />
            Unknown tab “{tab}”.
          </div>
        ) : null}

      </main>

      <footer className="mx-auto max-w-7xl px-4 text-center text-[11px] text-slate-400">
        ABA POS · signed in as {user ? `${user.username} (${admin ? "administrator" : "cashier"})` : "?"} ·
        API <span className="font-mono">{API_BASE}</span>
      </footer>
    </div>
  );
}

/**
 * The POS refuses every API call without a bearer token, so the app starts on
 * the sign-in screen and drops straight back to it whenever the session ends
 * (expired token, revoked by an administrator, or a 401 from any request).
 */
export default function App() {
  const [session, setSession] = useState(() => ({ token: getToken(), user: getUser() }));
  const [notice, setNotice] = useState("");

  useEffect(
    () =>
      subscribeToSession(() => {
        const token = getToken();
        setSession({ token, user: getUser() });
        setNotice(token ? "" : "Your session ended - please sign in again.");
      }),
    []
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      // the token may already be gone (expired / revoked) - that is fine
    }
    clearSession();
  }, []);

  const signedIn = useCallback((user) => {
    setSession({ token: getToken(), user });
    setNotice("");
  }, []);

  return (
    <ToastProvider>
      {session.token ? (
        <Shell user={session.user} onSignOut={signOut} />
      ) : (
        <LoginPage onSignedIn={signedIn} notice={notice} />
      )}
    </ToastProvider>
  );
}
