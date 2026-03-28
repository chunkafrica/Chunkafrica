"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import { api } from "@/lib/api";
import {
  subscribeToOperationsSync,
  type InventoryAdjustment,
} from "@/lib/operations-sync";
import { StoreStateCard } from "@/components/store-state-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { useActiveStore } from "@/lib/store-context";

type InventoryItemBalance = {
  id: string;
  name: string;
  sku: string | null;
  itemType: string;
  unitOfMeasure: string;
  defaultCostPerUnit: string | null;
  defaultSellingPrice: string | null;
  restockPoint: string | null;
  isActive: boolean;
  trackExpiry: boolean;
  onHandQuantity: string;
  lastMovementAt: string | null;
};

type StockInResponse = {
  id: string;
  receivedAt: string;
  notes: string | null;
  externalReference: string | null;
  items: Array<{
    id: string;
    inventoryItemId: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
    expiryDate: string | null;
    inventoryItem: {
      id: string;
      name: string;
      unitOfMeasure: string;
    };
  }>;
};

type StockInFormState = {
  inventoryItemId: string;
  quantity: string;
  unitCost: string;
  receivedAt: string;
  externalReference: string;
  notes: string;
  expiryDate: string;
};

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

function formatNumber(value: string | null) {
  if (!value) {
    return "0";
  }

  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No movement yet";
  }

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

function isLowStock(item: InventoryItemBalance) {
  if (!item.restockPoint) {
    return false;
  }

  return Number(item.onHandQuantity) <= Number(item.restockPoint);
}

function createInitialFormState(items: InventoryItemBalance[]): StockInFormState {
  const firstItem = items[0];

  return {
    inventoryItemId: firstItem?.id ?? "",
    quantity: "",
    unitCost: firstItem?.defaultCostPerUnit ?? "",
    receivedAt: formatDateTimeLocalInput(),
    externalReference: "",
    notes: "",
    expiryDate: "",
  };
}

function matchesInventoryAdjustment(
  item: InventoryItemBalance,
  adjustment: InventoryAdjustment,
) {
  if (adjustment.inventoryItemId && adjustment.inventoryItemId === item.id) {
    return true;
  }

  if (!adjustment.inventoryItemName) {
    return false;
  }

  return adjustment.inventoryItemName.toLowerCase() === item.name.toLowerCase();
}

function applyInventoryAdjustments(
  items: InventoryItemBalance[],
  adjustments: InventoryAdjustment[],
  occurredAt: string,
) {
  return items.map((item) => {
    const quantityChange = adjustments.reduce((total, adjustment) => {
      if (!matchesInventoryAdjustment(item, adjustment)) {
        return total;
      }

      return total + adjustment.quantityChange;
    }, 0);

    if (quantityChange === 0) {
      return item;
    }

    const nextOnHandQuantity = Math.max(0, Number(item.onHandQuantity) + quantityChange);

    return {
      ...item,
      onHandQuantity: String(nextOnHandQuantity),
      lastMovementAt: occurredAt,
    };
  });
}

export default function InventoryPage() {
  const {
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
  } = useActiveStore();
  const [items, setItems] = useState<InventoryItemBalance[]>([]);
  const [form, setForm] = useState<StockInFormState>(createInitialFormState([]));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadInventory(options?: {
    silent?: boolean;
    preserveMessages?: boolean;
  }) {
    if (!activeStoreId) {
      setItems([]);
      setForm(createInitialFormState([]));
      setIsLoading(false);
      return;
    }

    if (!options?.silent) {
      setIsLoading(true);
    }

    if (!options?.preserveMessages) {
      setErrorMessage(null);
    }

    try {
      const response = await api.get<InventoryItemBalance[]>(
        `/stores/${activeStoreId}/inventory/on-hand`,
      );

      setItems(response.data);
      setForm((current) => {
        const selectedItem =
          response.data.find((item) => item.id === current.inventoryItemId) ??
          response.data[0];

        return {
          ...current,
          inventoryItemId: selectedItem?.id ?? "",
          unitCost: current.unitCost || selectedItem?.defaultCostPerUnit || "",
        };
      });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (isResolvingStore) {
      return;
    }

    if (!activeStoreId) {
      setItems([]);
      setForm(createInitialFormState([]));
      setIsLoading(false);
      return;
    }

    void loadInventory();
  }, [activeStoreId, isResolvingStore]);

  useEffect(() => {
    if (!activeStoreId) {
      return;
    }

    return subscribeToOperationsSync((event) => {
      if (event.kind !== "production-batch-completed") {
        return;
      }

      if (event.adjustments.length > 0) {
        setItems((current) =>
          applyInventoryAdjustments(current, event.adjustments, event.occurredAt),
        );
      }

      void loadInventory({ silent: true, preserveMessages: true });
    });
  }, [activeStoreId]);

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => {
      if (name === "inventoryItemId") {
        const selectedItem = items.find((item) => item.id === value);

        return {
          ...current,
          inventoryItemId: value,
          unitCost:
            current.unitCost && current.inventoryItemId === value
              ? current.unitCost
              : selectedItem?.defaultCostPerUnit ?? "",
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
      setErrorMessage("Select an active store before updating inventory.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const selectedItem = items.find((item) => item.id === form.inventoryItemId);
      const payload = {
        receivedAt: new Date(form.receivedAt).toISOString(),
        externalReference: form.externalReference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        items: [
          {
            inventoryItemId: form.inventoryItemId,
            quantity: Number(form.quantity),
            unitCost: Number(form.unitCost),
            expiryDate: form.expiryDate
              ? new Date(form.expiryDate).toISOString()
              : undefined,
          },
        ],
      };

      const response = await api.post<StockInResponse>(
        `/stores/${activeStoreId}/stock-ins`,
        payload,
      );

      await loadInventory();

      setForm((current) => ({
        ...current,
        quantity: "",
        unitCost: selectedItem?.defaultCostPerUnit ?? current.unitCost,
        externalReference: "",
        notes: "",
        expiryDate: "",
        receivedAt: formatDateTimeLocalInput(),
      }));

      const postedItem = response.data.items[0];
      setSuccessMessage(
        `Stock added for ${postedItem.inventoryItem.name}: ${formatNumber(postedItem.quantity)} ${postedItem.inventoryItem.unitOfMeasure}.`,
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
          eyebrow="Inventory Ops"
          title="What is on hand, what is low, and what needs restocking?"
          description="Current stock position for production operations, plus a simple stock-in flow for recording fresh supply."
        />
        <StoreStateCard
          title="Resolving active store"
          description="Chunk is loading the active store before requesting inventory data."
        />
      </section>
    );
  }

  if (!activeStoreId) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Inventory Ops"
          title="What is on hand, what is low, and what needs restocking?"
          description="Current stock position for production operations, plus a simple stock-in flow for recording fresh supply."
        />
        <StoreStateCard
          title={storeErrorMessage ? "Unable to load stores" : "No active store found"}
          description={
            storeErrorMessage ??
            "Create or activate a store first. Inventory Ops requests stay paused until a real store is selected."
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Inventory Ops"
        title="What is on hand, what is low, and what needs restocking?"
        description={`Current stock position for production operations${activeStore ? ` in ${activeStore.name}` : ""}, plus a simple stock-in flow for recording fresh supply.`}
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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Available inventory</h3>
            <Button
              onClick={() => void loadInventory()}
              variant="secondary"
              size="sm"
            >
              Refresh
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-600">Loading inventory...</p>
            ) : null}

            {!isLoading && items.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">
                No inventory items available yet.
              </div>
            ) : null}

            {items.map((item) => (
              <div key={item.id} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.sku ?? "No SKU"} | {item.itemType.replaceAll("_", " ")}
                    </p>
                  </div>

                  {isLowStock(item) ? <StatusChip tone="warning">Low stock</StatusChip> : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      On hand
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {formatNumber(item.onHandQuantity)} {item.unitOfMeasure}
                    </p>
                  </div>

                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Restock point
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {item.restockPoint
                        ? `${formatNumber(item.restockPoint)} ${item.unitOfMeasure}`
                        : "Not set"}
                    </p>
                  </div>

                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Unit cost
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {formatCurrency(item.defaultCostPerUnit)}
                    </p>
                  </div>

                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Last movement
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {formatDateTime(item.lastMovementAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Add stock</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Record one stock-in line and refresh the inventory view immediately after
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
                    {item.name} ({formatNumber(item.onHandQuantity)} {item.unitOfMeasure})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Quantity received
              </span>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                name="quantity"
                value={form.quantity}
                onChange={handleFieldChange}
                className="ui-input"
                placeholder="0.0000"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Unit cost
              </span>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                name="unitCost"
                value={form.unitCost}
                onChange={handleFieldChange}
                className="ui-input"
                placeholder="0.0000"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Received at
              </span>
              <input
                type="datetime-local"
                name="receivedAt"
                value={form.receivedAt}
                onChange={handleFieldChange}
                className="ui-input"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                External reference
              </span>
              <input
                type="text"
                name="externalReference"
                value={form.externalReference}
                onChange={handleFieldChange}
                className="ui-input"
                placeholder="Optional"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Expiry date
              </span>
              <input
                type="datetime-local"
                name="expiryDate"
                value={form.expiryDate}
                onChange={handleFieldChange}
                className="ui-input"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Notes
              </span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleFieldChange}
                className="ui-textarea min-h-28"
                placeholder="Optional note for this stock-in"
              />
            </label>

            <Button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              fullWidth
            >
              {isSubmitting ? "Posting stock..." : "Add stock"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
