import React, { useState } from "react";
import api, { ApiError } from "../api";
import { Badge, Button, EmptyState, Field, Input, Textarea } from "../components/ui";
import Modal, { ConfirmDialog } from "../components/Modal";
import { useToast } from "../components/Toast";

const PALETTE = [
  "#2f5ff5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

const EMPTY = { id: null, name: "", description: "", color: PALETTE[0] };

export default function CategoriesPage({ categories, products, loading, onReload }) {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const counts = products.reduce((acc, product) => {
    const key = product.category_id || 0;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const openNew = () => {
    setError("");
    setForm({ ...EMPTY });
  };

  const openEdit = (category) => {
    setError("");
    setForm({
      id: category.id,
      name: category.name || "",
      description: category.description || "",
      color: category.color || PALETTE[0],
    });
  };

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  const save = async (event) => {
    event.preventDefault();
    if (!form || !form.name.trim()) {
      setError("A category name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      color: form.color || null,
    };
    try {
      if (form.id) {
        await api.updateCategory(form.id, payload);
        toast.success(`"${payload.name}" updated`);
      } else {
        await api.createCategory(payload);
        toast.success(`"${payload.name}" created`);
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
      await api.deleteCategory(pendingDelete.id);
      toast.success(`"${pendingDelete.name}" deleted`);
      setPendingDelete(null);
      onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  /* ===CATS_RENDER=== */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-sm text-slate-500">
          {loading ? "Loading…" : `${categories.length} category(ies)`} ·{" "}
          {products.length} product(s)
        </p>
        <Button className="ml-auto" onClick={openNew}>
          + New category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          hint="Group your products (drinks, food, retail…) to filter them quickly in the POS."
          action={
            <Button className="mt-2" onClick={openNew}>
              + New category
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-8 w-8 shrink-0 rounded-lg"
                  style={{ backgroundColor: category.color || "#64748b" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{category.name}</p>
                  <p className="line-clamp-2 text-xs text-slate-400">
                    {category.description || "No description"}
                  </p>
                </div>
                <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                  {(counts[category.id] || 0) + " item(s)"}
                </Badge>
              </div>
              <div className="mt-auto flex justify-end gap-1.5 pt-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(category)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setPendingDelete(category)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        size="sm"
        title={form && form.id ? "Edit category" : "New category"}
        onClose={() => !saving && setForm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" loading={saving}>
              {form && form.id ? "Save changes" : "Create category"}
            </Button>
          </>
        }
      >
        {form ? (
          <form id="category-form" onSubmit={save} className="space-y-4">
            <Field label="Name" required>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Drinks"
              />
            </Field>

            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Cold and hot beverages"
              />
            </Field>

            <Field label="Colour">
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    onClick={() => update({ color: colour })}
                    style={{ backgroundColor: colour }}
                    className={
                      form.color === colour
                        ? "h-8 w-8 rounded-lg ring-2 ring-slate-800 ring-offset-2"
                        : "h-8 w-8 rounded-lg ring-1 ring-slate-200"
                    }
                    aria-label={colour}
                  />
                ))}
              </div>
            </Field>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete category"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed. Categories still used by products cannot be deleted.`
            : ""
        }
        confirmLabel="Delete category"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
