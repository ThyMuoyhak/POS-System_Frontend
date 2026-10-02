import React, { useMemo, useState } from "react";
import api, { ApiError } from "../api";
import { formatMoney } from "../utils";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Thumb,
} from "../components/ui";
import Modal, { ConfirmDialog } from "../components/Modal";
import { useToast } from "../components/Toast";

const EMPTY_FORM = {
  id: null,
  title: "",
  description: "",
  image_url: "",
  sku: "",
  price: "",
  discount: "0",
  stock: "0",
  category_id: "",
  is_active: true,
};

export default function ProductsPage({ products, categories, currency, loading, onReload }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && String(product.category_id || "") !== String(categoryId)) {
        return false;
      }
      if (!term) return true;
      return (
        product.title.toLowerCase().includes(term) ||
        String(product.sku || "").toLowerCase().includes(term)
      );
    });
  }, [products, search, categoryId]);

  const openNew = () => {
    setError("");
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (product) => {
    setError("");
    setForm({
      id: product.id,
      title: product.title || "",
      description: product.description || "",
      image_url: product.image_url || "",
      sku: product.sku || "",
      price: String(product.price ?? ""),
      discount: String(product.discount ?? 0),
      stock: String(product.stock ?? 0),
      category_id: product.category_id ? String(product.category_id) : "",
      is_active: !!product.is_active,
    });
  };

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  const save = async (event) => {
    event.preventDefault();
    if (!form) return;
    if (!form.title.trim()) {
      setError("A product title is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      image_url: form.image_url || null,
      sku: form.sku ? form.sku.trim() : null,
      price: Number(form.price || 0),
      discount: Number(form.discount || 0),
      stock: Number(form.stock || 0),
      category_id: form.category_id ? Number(form.category_id) : null,
      is_active: !!form.is_active,
    };
    try {
      if (form.id) {
        await api.updateProduct(form.id, payload);
        toast.success(`"${payload.title}" updated`);
      } else {
        await api.createProduct(payload);
        toast.success(`"${payload.title}" created`);
      }
      setForm(null);
      onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteProduct(pendingDelete.id);
      toast.success(`"${pendingDelete.title}" deleted`);
      setPendingDelete(null);
      onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const adjustStock = async (product, amount) => {
    try {
      await api.adjustStock(product.id, amount);
      onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    }
  };

  const toggleActive = async (product) => {
    try {
      await api.updateProduct(product.id, { is_active: !product.is_active });
      onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    }
  };

  /* ===PRODUCTS_RENDER=== */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or SKU…"
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
        <span className="text-xs text-slate-400">
          {loading ? "Loading…" : `${visible.length} of ${products.length}`}
        </span>
        <Button className="ml-auto" onClick={openNew}>
          + New product
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={products.length ? "No product matches your filters" : "No products yet"}
          hint="Create your first product with a title, price, discount, stock and image url."
          action={
            <Button className="mt-2" onClick={openNew}>
              + New product
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="scroll-thin overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Product</th>
                  <th className="px-4 py-2.5 font-bold">Category</th>
                  <th className="px-4 py-2.5 text-right font-bold">Price</th>
                  <th className="px-4 py-2.5 text-right font-bold">Discount</th>
                  <th className="px-4 py-2.5 text-right font-bold">Sells at</th>
                  <th className="px-4 py-2.5 text-center font-bold">Stock</th>
                  <th className="px-4 py-2.5 text-center font-bold">Active</th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* ===PRODUCTS_ROWS=== */}
                {visible.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Thumb
                          src={product.image_url}
                          title={product.title}
                          className="h-10 w-10 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {product.title}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {product.sku || "no SKU"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {product.category_name || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {formatMoney(product.price, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {Number(product.discount) > 0 ? (
                        <Badge className="bg-rose-100 text-rose-700 ring-rose-200">
                          -{product.discount}%
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-brand-700">
                      {formatMoney(product.final_price, currency)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => adjustStock(product, -1)}
                          className="h-6 w-6 rounded bg-slate-100 text-sm font-bold text-slate-500 hover:bg-slate-200"
                        >
                          −
                        </button>
                        <span
                          className={
                            Number(product.stock) <= 5
                              ? "w-10 text-center font-bold text-rose-600"
                              : "w-10 text-center font-semibold text-slate-700"
                          }
                        >
                          {product.stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustStock(product, 1)}
                          className="h-6 w-6 rounded bg-slate-100 text-sm font-bold text-slate-500 hover:bg-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(product)}
                        className={
                          product.is_active
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-200"
                            : "rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-500 ring-1 ring-slate-300"
                        }
                      >
                        {product.is_active ? "on" : "off"}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(product)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setPendingDelete(product)}
                        >
                          Delete
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

      {/* ===PRODUCTS_FORM=== */}
      <Modal
        open={!!form}
        size="lg"
        title={form && form.id ? "Edit product" : "New product"}
        subtitle="Image url, title, description, price, discount and stock."
        onClose={() => !saving && setForm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" loading={saving}>
              {form && form.id ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      >
        {form ? (
          <form id="product-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required className="sm:col-span-2">
              <Input
                autoFocus
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Iced Americano 500ml"
              />
            </Field>

            <Field label="SKU" hint="Optional unique code">
              <Input
                value={form.sku}
                onChange={(e) => update({ sku: e.target.value })}
                placeholder="DRK-001"
              />
            </Field>

            <Field label="Category">
              <Select
                value={form.category_id}
                onChange={(e) => update({ category_id: e.target.value })}
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Price" required hint={`Stored in ${currency}`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => update({ price: e.target.value })}
                placeholder="3.50"
              />
            </Field>

            <Field label="Discount %" hint="0 – 100, applied to the price">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.discount}
                onChange={(e) => update({ discount: e.target.value })}
              />
            </Field>

            <Field label="Stock">
              <Input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => update({ stock: e.target.value })}
              />
            </Field>

            <div className="flex items-end pb-1">
              <Checkbox
                label="Available for sale"
                checked={form.is_active}
                onChange={(value) => update({ is_active: value })}
                hint="Disabled products stay in the list but cannot be sold."
              />
            </div>

            <Field label="Image url" className="sm:col-span-2">
              <Input
                value={form.image_url}
                onChange={(e) => update({ image_url: e.target.value })}
                placeholder="https://example.com/coffee.jpg"
              />
            </Field>

            <div className="flex items-center gap-3 sm:col-span-2">
              <Thumb
                src={form.image_url}
                title={form.title || "Preview"}
                className="h-16 w-16 rounded-lg"
              />
              <p className="text-xs text-slate-400">
                Live preview · final price{" "}
                <span className="font-bold text-brand-700">
                  {formatMoney(
                    Number(form.price || 0) * (1 - Number(form.discount || 0) / 100),
                    currency
                  )}
                </span>
              </p>
            </div>

            <Field label="Description" className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Short description shown on the product card."
              />
            </Field>

            {error ? (
              <p className="whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete product"
        message={
          pendingDelete
            ? `"${pendingDelete.title}" will be removed permanently. Past orders keep their own copy of the product details.`
            : ""
        }
        confirmLabel="Delete product"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

    </div>
  );
}
