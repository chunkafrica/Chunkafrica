"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StoreStateCard } from "@/components/store-state-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { useActiveStore } from "@/lib/store-context";

type WasteCategory = {
  id: string;
  name: string;
  description: string | null;
};

type InventoryBalance = {
  id: string;
  name: string;
  sku: string | null;
  unitOfMeasure: string;
  onHandQuantity: string;
  defaultCostPerUnit: string | null;
};

type WasteLog = {
  id: string;
  quantity: string;
  occurredAt: string;
  note: string | null;
  costAtLossSnapshot: string | null;
  inventoryItem: {
    id: string;
    name: string;
    unitOfMeasure: string;
  };
  wasteCategory: {
    id: string;
    name: string;
  };
  createdByUser: {
    id: string;
    fullName: string;
  };
  stockMovement: {
    id: string;
    quantityChange: string;
    occurredAt: string;
  } | null;
};

type WasteFormState = {
  inventoryItemId: string;
  wasteCategoryId: string;
  quantity: string;
  occurredAt: string;
  costAtLossSnapshot: string;
  note: string;
};

function formatNumber(value: string | null) {
  if (!value) {
    return "0";
  }

  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatCurrency(value: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateTimeLocalInput(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function extractErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data
  ) {
    const message = error.response.data.message;
    return Array.isArray(message) ? message.join(", ") : String(message);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

function createInitialWasteForm(
  items: InventoryBalance[],
  categories: WasteCategory[],
): WasteFormState {
  const firstItem = items.find((item) => Number(item.onHandQuantity) > 0) ?? items[0];
  const firstCategory = categories[0];

  return {
    inventoryItemId: firstItem?.id ?? "",
    wasteCategoryId: firstCategory?.id ?? "",
    quantity: "",
    occurredAt: formatDateTimeLocalInput(),
    costAtLossSnapshot: firstItem?.defaultCostPerUnit ?? "",
    note: "",
  };
}

export default function WastePage() {
  const {
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
  } = useActiveStore();
  const [categories, setCategories] = useState<WasteCategory[]>([]);
  const [items, setItems] = useState<InventoryBalance[]>([]);
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [form, setForm] = useState<WasteFormState>(
    createInitialWasteForm([], []),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === form.inventoryItemId) ?? null;

  async function loadWasteView() {
    if (!activeStoreId) {
      setLogs([]);
      setItems([]);
      setIsLoading(false);
      return {
        categories: [] as WasteCategory[],
        logs: [] as WasteLog[],
        items: [] as InventoryBalance[],
      };
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [categoriesResponse, logsResponse, inventoryResponse] = await Promise.all([
        api.get<WasteCategory[]>("/waste-categories"),
        api.get<WasteLog[]>(`/stores/${activeStoreId}/waste-logs`),
        api.get<InventoryBalance[]>(`/stores/${activeStoreId}/inventory/on-hand`),
      ]);

      setCategories(categoriesResponse.data);
      setLogs(logsResponse.data);
      setItems(inventoryResponse.data);

      setForm((current) => {
        const nextItem =
          inventoryResponse.data.find((item) => item.id === current.inventoryItemId) ??
          inventoryResponse.data.find((item) => Number(item.onHandQuantity) > 0) ??
          inventoryResponse.data[0];
        const nextCategory =
          categoriesResponse.data.find((category) => category.id === current.wasteCategoryId) ??
          categoriesResponse.data[0];

        return {
          ...current,
          inventoryItemId: nextItem?.id ?? "",
          wasteCategoryId: nextCategory?.id ?? "",
          costAtLossSnapshot:
            current.costAtLossSnapshot || nextItem?.defaultCostPerUnit || "",
        };
      });

      return {
        categories: categoriesResponse.data,
        logs: logsResponse.data,
        items: inventoryResponse.data,
      };
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      return {
        categories: [] as WasteCategory[],
        logs: [] as WasteLog[],
        items: [] as InventoryBalance[],
      };
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isResolvingStore) {
      return;
    }

    if (!activeStoreId) {
      setLogs([]);
      setItems([]);
      setIsLoading(false);
      return;
    }

    void loadWasteView();
  }, [activeStoreId, isResolvingStore]);

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => {
      if (name === "inventoryItemId") {
        const item = items.find((entry) => entry.id === value);

        return {
          ...current,
          inventoryItemId: value,
          costAtLossSnapshot: item?.defaultCostPerUnit ?? "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeStoreId) {
      setErrorMessage("Select an active store before logging waste.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        inventoryItemId: form.inventoryItemId,
        wasteCategoryId: form.wasteCategoryId,
        quantity: Number(form.quantity),
        occurredAt: new Date(form.occurredAt).toISOString(),
        costAtLossSnapshot: form.costAtLossSnapshot
          ? Number(form.costAtLossSnapshot)
          : undefined,
        note: form.note.trim() || undefined,
      };

      const response = await api.post<WasteLog>(
        `/stores/${activeStoreId}/waste-logs`,
        payload,
      );

      const refreshed = await loadWasteView();
      const nextItem =
        refreshed.items.find((item) => item.id === response.data.inventoryItem.id) ??
        refreshed.items.find((item) => Number(item.onHandQuantity) > 0) ??
        refreshed.items[0];

      setForm({
        inventoryItemId: nextItem?.id ?? "",
        wasteCategoryId: response.data.wasteCategory.id,
        quantity: "",
        occurredAt: formatDateTimeLocalInput(),
        costAtLossSnapshot: nextItem?.defaultCostPerUnit ?? "",
        note: "",
      });

      setSuccessMessage(
        `Waste logged for ${response.data.inventoryItem.name}: ${formatNumber(response.data.quantity)} ${response.data.inventoryItem.unitOfMeasure}.`,
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isResolvingStore) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Waste"
          title="What value was lost, and where is waste showing up?"
          description="Log waste against available inventory and review recent waste activity in the store."
        />
        <StoreStateCard
          title="Resolving active store"
          description="Chunk is loading the active store before requesting waste data."
        />
      </section>
    );
  }

  if (!activeStoreId) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Waste"
          title="What value was lost, and where is waste showing up?"
          description="Log waste against available inventory and review recent waste activity in the store."
        />
        <StoreStateCard
          title={storeErrorMessage ? "Unable to load stores" : "No active store found"}
          description={
            storeErrorMessage ??
            "Create or activate a store first. Waste requests stay paused until a real store is selected."
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Waste"
        title="What value was lost, and where is waste showing up?"
        description={`Log waste against available inventory and review recent waste activity${activeStore ? ` in ${activeStore.name}` : ""}.`}
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Recent waste logs</h3>
            <Button
              onClick={() => void loadWasteView()}
              variant="secondary"
              size="sm"
            >
              Refresh
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-600">Loading waste activity...</p>
            ) : null}

            {!isLoading && logs.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">
                No waste logs yet.
              </div>
            ) : null}

            {logs.map((log) => (
              <div key={log.id} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{log.inventoryItem.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {log.wasteCategory.name} | {formatDateTime(log.occurredAt)}
                    </p>
                  </div>

                  <StatusChip tone="warning">
                    {formatNumber(log.quantity)} {log.inventoryItem.unitOfMeasure}
                  </StatusChip>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Cost at loss
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {formatCurrency(log.costAtLossSnapshot)}
                    </p>
                  </div>

                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Logged by
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {log.createdByUser.fullName}
                    </p>
                  </div>
                </div>

                {log.note ? (
                  <p className="mt-3 text-sm text-slate-600">{log.note}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Log waste</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Record a single waste event and refresh the waste view immediately after
            posting.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Inventory item
              </span>
              <select
                name="inventoryItemId"
                value={form.inventoryItemId}
                onChange={handleFieldChange}
                className="ui-input"
                required
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({formatNumber(item.onHandQuantity)} {item.unitOfMeasure} on hand)
                  </option>
                ))}
              </select>
            </label>

            {selectedItem ? (
              <div className="ui-subtle-panel text-sm text-slate-700">
                <p>
                  On hand: {formatNumber(selectedItem.onHandQuantity)}{" "}
                  {selectedItem.unitOfMeasure}
                </p>
                <p className="mt-1">
                  Default cost: {formatCurrency(selectedItem.defaultCostPerUnit)}
                </p>
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Waste category
              </span>
              <select
                name="wasteCategoryId"
                value={form.wasteCategoryId}
                onChange={handleFieldChange}
                className="ui-input"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Quantity lost
              </span>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                name="quantity"
                value={form.quantity}
                onChange={handleFieldChange}
                className="ui-input"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Occurred at
              </span>
              <input
                type="datetime-local"
                name="occurredAt"
                value={form.occurredAt}
                onChange={handleFieldChange}
                className="ui-input"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Cost at loss snapshot
              </span>
              <input
                type="number"
                min="0"
                step="0.0001"
                name="costAtLossSnapshot"
                value={form.costAtLossSnapshot}
                onChange={handleFieldChange}
                className="ui-input"
                placeholder="Optional"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Note
              </span>
              <textarea
                name="note"
                value={form.note}
                onChange={handleFieldChange}
                className="ui-textarea"
                placeholder="Optional waste note"
              />
            </label>

            <Button
              type="submit"
              disabled={isSubmitting || items.length === 0 || categories.length === 0}
              fullWidth
            >
              {isSubmitting ? "Logging waste..." : "Log waste"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
