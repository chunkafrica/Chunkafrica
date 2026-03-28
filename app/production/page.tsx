"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  emitOperationsSync,
  type InventoryAdjustment,
} from "@/lib/operations-sync";
import { StoreStateCard } from "@/components/store-state-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { useActiveStore } from "@/lib/store-context";

type RecipeOption = {
  id: string;
  menuItemId: string;
  producedInventoryItemId: string;
  version: number;
  yieldQuantity: string;
  isActive: boolean;
  instructions: string | null;
  menuItem: {
    id: string;
    name: string;
  };
  producedInventoryItem: {
    id: string;
    name: string;
    unitOfMeasure: string;
  };
  recipeItems: Array<{
    id: string;
    inventoryItemId: string;
    quantityRequired: string;
    inventoryItem: {
      id: string;
      name: string;
      unitOfMeasure: string;
    };
  }>;
};

type ProductionBatchSummary = {
  id: string;
  batchNumber: string | null;
  batchDate: string;
  plannedOutputQuantity: string | null;
  actualOutputQuantity: string;
  status: string;
  notes: string | null;
  menuItem: {
    id: string;
    name: string;
  };
  recipe: {
    id: string;
    version: number;
    isActive: boolean;
  };
  producedInventoryItem: {
    name: string;
    unitOfMeasure: string;
  };
  _count: {
    ingredients: number;
  };
};

type ProductionBatchMutationResponse = {
  id: string;
  batchNumber: string | null;
  plannedOutputQuantity: string | null;
  actualOutputQuantity: string;
  status: string;
  menuItem: {
    name: string;
  };
  producedInventoryItem: {
    name: string;
    unitOfMeasure: string;
  };
};

type CreateBatchFormState = {
  recipeId: string;
  batchDate: string;
  plannedOutputQuantity: string;
  batchNumber: string;
  notes: string;
};

type CompleteBatchFormState = {
  batchId: string;
  completedAt: string;
  actualOutputQuantity: string;
  notes: string;
};

type ProductionViewData = {
  recipes: RecipeOption[];
  batches: ProductionBatchSummary[];
  salesReport: SalesReportResponse | null;
};

type SalesReportResponse = {
  summary: {
    totalSales: string;
    totalOrders: number;
    averageOrderValue: string;
  };
  topSellingMenuItems: Array<{
    menuItemId: string;
    menuItemName: string;
    quantitySold: string;
    salesTotal: string;
  }>;
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

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function formatVariance(value: number, unitOfMeasure: string) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(String(value))} ${unitOfMeasure}`;
}

function getBatchVariance(batch: ProductionBatchSummary) {
  if (!batch.plannedOutputQuantity) {
    return null;
  }

  return Number(batch.actualOutputQuantity) - Number(batch.plannedOutputQuantity);
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

function createInitialCreateForm(recipes: RecipeOption[]): CreateBatchFormState {
  const firstRecipe = recipes[0];

  return {
    recipeId: firstRecipe?.id ?? "",
    batchDate: formatDateTimeLocalInput(),
    plannedOutputQuantity: firstRecipe?.yieldQuantity ?? "",
    batchNumber: "",
    notes: "",
  };
}

function createInitialCompleteForm(
  batches: ProductionBatchSummary[],
): CompleteBatchFormState {
  const openBatch = batches.find(
    (batch) => batch.status === "PLANNED" || batch.status === "IN_PROGRESS",
  );

  return {
    batchId: openBatch?.id ?? "",
    completedAt: formatDateTimeLocalInput(),
    actualOutputQuantity:
      openBatch?.plannedOutputQuantity ?? openBatch?.actualOutputQuantity ?? "",
    notes: "",
  };
}

function getLast30DayRange() {
  const to = new Date();
  const from = new Date();

  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function getBatchStatusTone(value: string) {
  if (value === "COMPLETED") {
    return "success" as const;
  }

  if (value === "CANCELLED") {
    return "danger" as const;
  }

  if (value === "IN_PROGRESS") {
    return "primary" as const;
  }

  return "warning" as const;
}

function getVarianceStatusTone(value: number) {
  if (value < 0) {
    return "danger" as const;
  }

  if (value > 0) {
    return "warning" as const;
  }

  return "success" as const;
}

function getVarianceStatusLabel(value: number) {
  if (value < 0) {
    return "Underproduced";
  }

  if (value > 0) {
    return "Overproduced";
  }

  return "On target";
}

type DemandAlignment = "under" | "over" | "aligned";

function getDemandAlignment(
  actualOutputQuantity: number,
  salesSignalQuantity: number,
): DemandAlignment {
  if (salesSignalQuantity > actualOutputQuantity) {
    return "under";
  }

  if (salesSignalQuantity < actualOutputQuantity) {
    return "over";
  }

  return "aligned";
}

function getDemandInsightMessage(alignment: DemandAlignment) {
  if (alignment === "under") {
    return "You are underproducing relative to demand";
  }

  if (alignment === "over") {
    return "You may be overproducing relative to demand";
  }

  return "Production is aligned with current demand";
}

function getDemandInsightTone(alignment: DemandAlignment) {
  if (alignment === "under") {
    return "warning" as const;
  }

  if (alignment === "over") {
    return "neutral" as const;
  }

  return "success" as const;
}

function getDemandInsightPanelClassName(alignment: DemandAlignment) {
  if (alignment === "under") {
    return "border-amber-200 bg-amber-50/70";
  }

  if (alignment === "over") {
    return "border-slate-200 bg-background";
  }

  return "border-emerald-200 bg-emerald-50/70";
}

function getSuggestedActionMessage(
  alignment: DemandAlignment,
  adjustmentQuantity: number,
) {
  if (alignment === "under") {
    return `Increase next batch size by ${formatNumber(String(adjustmentQuantity))} units`;
  }

  if (alignment === "over") {
    return "Reduce next batch size";
  }

  return "Maintain current production level";
}

function buildInventoryAdjustmentsForCompletedBatch(
  batch: ProductionBatchSummary | null,
  recipe: RecipeOption | null,
  actualOutputQuantity: number,
): InventoryAdjustment[] {
  if (!batch || !recipe || actualOutputQuantity <= 0) {
    return [];
  }

  const recipeYieldQuantity = Number(recipe.yieldQuantity);
  const ingredientAdjustments =
    recipeYieldQuantity > 0
      ? recipe.recipeItems.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          inventoryItemName: item.inventoryItem.name,
          quantityChange:
            (-Number(item.quantityRequired) * actualOutputQuantity) /
            recipeYieldQuantity,
        }))
      : [];

  return [
    ...ingredientAdjustments,
    {
      inventoryItemId: recipe.producedInventoryItem.id,
      inventoryItemName: recipe.producedInventoryItem.name,
      quantityChange: actualOutputQuantity,
    },
  ].filter(
    (adjustment) =>
      Number.isFinite(adjustment.quantityChange) &&
      adjustment.quantityChange !== 0,
  );
}

export default function ProductionPage() {
  const {
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
  } = useActiveStore();
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [batches, setBatches] = useState<ProductionBatchSummary[]>([]);
  const [salesReport, setSalesReport] = useState<SalesReportResponse | null>(null);
  const [createForm, setCreateForm] = useState<CreateBatchFormState>(
    createInitialCreateForm([]),
  );
  const [completeForm, setCompleteForm] = useState<CompleteBatchFormState>(
    createInitialCompleteForm([]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openBatches = batches.filter(
    (batch) => batch.status === "PLANNED" || batch.status === "IN_PROGRESS",
  );
  const completedBatches = batches.filter((batch) => batch.status === "COMPLETED");
  const batchesWithExpectedOutput = batches.filter(
    (batch) => batch.plannedOutputQuantity !== null,
  );
  const offPlanCompletedBatches = completedBatches.filter((batch) => {
    if (!batch.plannedOutputQuantity) {
      return false;
    }

    return Number(batch.actualOutputQuantity) !== Number(batch.plannedOutputQuantity);
  });
  const selectedRecipe =
    recipes.find((recipe) => recipe.id === createForm.recipeId) ?? null;
  const selectedBatch =
    batches.find((batch) => batch.id === completeForm.batchId) ?? null;
  const salesByMenuItemId = new Map(
    salesReport?.topSellingMenuItems.map((item) => [item.menuItemId, item]) ?? [],
  );
  const soldQuantityTotal =
    salesReport?.topSellingMenuItems.reduce((total, item) => {
      return total + Number(item.quantitySold);
    }, 0) ?? 0;

  async function loadProduction(): Promise<ProductionViewData> {
    if (!activeStoreId) {
      setRecipes([]);
      setBatches([]);
      setSalesReport(null);
      setIsLoading(false);
      return {
        recipes: [],
        batches: [],
        salesReport: null,
      };
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { from, to } = getLast30DayRange();
      const [recipesResponse, batchesResponse, salesReportResponse] = await Promise.all([
        api.get<RecipeOption[]>("/recipes", {
          params: { isActive: true },
        }),
        api.get<ProductionBatchSummary[]>(
          `/stores/${activeStoreId}/production-batches`,
        ),
        api.get<SalesReportResponse>(`/stores/${activeStoreId}/reports/sales`, {
          params: { from, to },
        }),
      ]);

      setRecipes(recipesResponse.data);
      setBatches(batchesResponse.data);
      setSalesReport(salesReportResponse.data);

      setCreateForm((current) => {
        const activeRecipe =
          recipesResponse.data.find((recipe) => recipe.id === current.recipeId) ??
          recipesResponse.data[0];

        return {
          ...current,
          recipeId: activeRecipe?.id ?? "",
          plannedOutputQuantity:
            current.plannedOutputQuantity || activeRecipe?.yieldQuantity || "",
        };
      });

      setCompleteForm((current) => {
        const activeBatch =
          batchesResponse.data.find((batch) => batch.id === current.batchId) ??
          batchesResponse.data.find(
            (batch) =>
              batch.status === "PLANNED" || batch.status === "IN_PROGRESS",
          );

        return {
          ...current,
          batchId: activeBatch?.id ?? "",
          actualOutputQuantity:
            current.actualOutputQuantity ||
            activeBatch?.plannedOutputQuantity ||
            activeBatch?.actualOutputQuantity ||
            "",
        };
      });

      return {
        recipes: recipesResponse.data,
        batches: batchesResponse.data,
        salesReport: salesReportResponse.data,
      };
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setSalesReport(null);

      return {
        recipes: [],
        batches: [],
        salesReport: null,
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
      setRecipes([]);
      setBatches([]);
      setSalesReport(null);
      setIsLoading(false);
      return;
    }

    void loadProduction();
  }, [activeStoreId, isResolvingStore]);

  function handleCreateFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setCreateForm((current) => {
      if (name === "recipeId") {
        const recipe = recipes.find((entry) => entry.id === value);

        return {
          ...current,
          recipeId: value,
          plannedOutputQuantity: recipe?.yieldQuantity ?? "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  function handleCompleteFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setCompleteForm((current) => {
      if (name === "batchId") {
        const batch = batches.find((entry) => entry.id === value);

        return {
          ...current,
          batchId: value,
          actualOutputQuantity:
            batch?.plannedOutputQuantity ?? batch?.actualOutputQuantity ?? "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  async function handleCreateBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeStoreId) {
      setErrorMessage("Select an active store before creating a batch.");
      return;
    }

    if (!selectedRecipe) {
      setErrorMessage("No active recipe is available for batch creation.");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        menuItemId: selectedRecipe.menuItemId,
        recipeId: selectedRecipe.id,
        batchDate: new Date(createForm.batchDate).toISOString(),
        plannedOutputQuantity: createForm.plannedOutputQuantity
          ? Number(createForm.plannedOutputQuantity)
          : undefined,
        batchNumber: createForm.batchNumber.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
      };

      const response = await api.post<ProductionBatchMutationResponse>(
        `/stores/${activeStoreId}/production-batches`,
        payload,
      );

      await loadProduction();

      setCreateForm((current) => ({
        ...current,
        batchDate: formatDateTimeLocalInput(),
        batchNumber: "",
        notes: "",
      }));

      setCompleteForm((current) => ({
        ...current,
        batchId: response.data.id,
        actualOutputQuantity:
          response.data.plannedOutputQuantity || selectedRecipe.yieldQuantity,
      }));

      setSuccessMessage(
        `Batch ${response.data.batchNumber ?? response.data.id} created for ${response.data.menuItem.name}.`,
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCompleteBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeStoreId) {
      setErrorMessage("Select an active store before completing a batch.");
      return;
    }

    if (!completeForm.batchId) {
      setErrorMessage("Choose a batch to complete.");
      return;
    }

    setIsCompleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const completingBatch =
        batches.find((batch) => batch.id === completeForm.batchId) ?? null;
      const completingRecipe = completingBatch
        ? recipes.find((recipe) => recipe.id === completingBatch.recipe.id) ?? null
        : null;
      const payload = {
        completedAt: new Date(completeForm.completedAt).toISOString(),
        actualOutputQuantity: Number(completeForm.actualOutputQuantity),
        notes: completeForm.notes.trim() || undefined,
      };

      const response = await api.post<ProductionBatchMutationResponse>(
        `/stores/${activeStoreId}/production-batches/${completeForm.batchId}/complete`,
        payload,
      );

      emitOperationsSync({
        kind: "production-batch-completed",
        batchId: response.data.id,
        occurredAt: payload.completedAt,
        adjustments: buildInventoryAdjustmentsForCompletedBatch(
          completingBatch,
          completingRecipe,
          Number(response.data.actualOutputQuantity),
        ),
      });

      const refreshed = await loadProduction();

      const nextOpenBatch = refreshed.batches.find(
        (batch) =>
          batch.id !== completeForm.batchId &&
          (batch.status === "PLANNED" || batch.status === "IN_PROGRESS"),
      );

      setCompleteForm({
        batchId: nextOpenBatch?.id ?? "",
        completedAt: formatDateTimeLocalInput(),
        actualOutputQuantity:
          nextOpenBatch?.plannedOutputQuantity ??
          nextOpenBatch?.actualOutputQuantity ??
          "",
        notes: "",
      });

      setSuccessMessage(
        `Batch ${response.data.batchNumber ?? response.data.id} completed with ${formatNumber(response.data.actualOutputQuantity)} ${response.data.producedInventoryItem.unitOfMeasure} output. Inventory views are syncing now.`,
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsCompleting(false);
    }
  }

  if (isResolvingStore) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Production Ops"
          title="What was produced, what should have been produced, and where is the gap?"
          description="Keep the live production flow working while making output control visible: what was planned, what was actually posted, what sales are pulling, and where variance shows up."
        />
        <StoreStateCard
          title="Resolving active store"
          description="Chunk is loading the active store before requesting production data."
        />
      </section>
    );
  }

  if (!activeStoreId) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Production Ops"
          title="What was produced, what should have been produced, and where is the gap?"
          description="Keep the live production flow working while making output control visible: what was planned, what was actually posted, what sales are pulling, and where variance shows up."
        />
        <StoreStateCard
          title={storeErrorMessage ? "Unable to load stores" : "No active store found"}
          description={
            storeErrorMessage ??
            "Create or activate a store first. Production Ops requests stay paused until a real store is selected."
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Production Ops"
        title="What was produced, what should have been produced, and where is the gap?"
        description={`Keep the live production flow working while making output control visible${activeStore ? ` in ${activeStore.name}` : ""}: what was planned, what was actually posted, what sales are pulling, and where variance shows up.`}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Completed batches
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : completedBatches.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Batches that already have actual output posted.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Open batches
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : openBatches.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Planned or in-progress runs still moving through production.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Expected output tracked
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : batchesWithExpectedOutput.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Batches where expected output is explicitly set.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Off-plan completed
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : offPlanCompletedBatches.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Completed batches where actual output differs from expected.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Production runs</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Expected output, actual output, sales signal, and variance by batch.
                </p>
              </div>
              <Button
                onClick={() => void loadProduction()}
                variant="secondary"
                size="sm"
              >
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="text-sm text-slate-600">Loading production batches...</p>
              ) : null}

              {!isLoading && batches.length === 0 ? (
                <div className="ui-row text-sm text-slate-600">
                  No production batches yet.
                </div>
              ) : null}

              {batches.map((batch) => {
                const variance = getBatchVariance(batch);
                const actualOutputQuantity = Number(batch.actualOutputQuantity);
                const salesSignalQuantity = Number(
                  salesByMenuItemId.get(batch.menuItem.id)?.quantitySold ?? "0",
                );
                const demandAlignment = getDemandAlignment(
                  actualOutputQuantity,
                  salesSignalQuantity,
                );
                const adjustmentQuantity = Math.abs(
                  salesSignalQuantity - actualOutputQuantity,
                );

                return (
                  <div key={batch.id} className="ui-row">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-ink">
                          {batch.batchNumber ?? batch.id}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {batch.menuItem.name}
                          {" -> "}
                          {batch.producedInventoryItem.name}
                        </p>
                      </div>

                      <StatusChip tone={getBatchStatusTone(batch.status)}>
                        {formatStatus(batch.status)}
                      </StatusChip>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="ui-stat">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Batch date
                        </p>
                        <p className="mt-1 text-sm font-medium text-ink">
                          {formatDateTime(batch.batchDate)}
                        </p>
                      </div>

                      <div className="ui-stat">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Expected output
                        </p>
                        <p className="mt-1 font-semibold text-ink">
                          {batch.plannedOutputQuantity
                            ? `${formatNumber(batch.plannedOutputQuantity)} ${batch.producedInventoryItem.unitOfMeasure}`
                            : "Not set"}
                        </p>
                      </div>

                      <div className="ui-stat">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Actual output
                        </p>
                        <p className="mt-1 font-semibold text-ink">
                          {formatNumber(batch.actualOutputQuantity)}{" "}
                          {batch.producedInventoryItem.unitOfMeasure}
                        </p>
                      </div>

                      <div className="ui-stat">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Variance
                        </p>
                        {variance === null ? (
                          <p className="mt-1 font-semibold text-ink">Not tracked</p>
                        ) : (
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="font-semibold text-ink">
                              {formatVariance(
                                variance,
                                batch.producedInventoryItem.unitOfMeasure,
                              )}
                            </p>
                            <StatusChip tone={getVarianceStatusTone(variance)}>
                              {getVarianceStatusLabel(variance)}
                            </StatusChip>
                          </div>
                        )}
                      </div>

                      <div className="ui-stat sm:col-span-2 xl:col-span-1">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Sales signal
                        </p>
                        <p className="mt-1 font-semibold text-ink">
                          {salesByMenuItemId.has(batch.menuItem.id)
                            ? `${formatNumber(String(salesSignalQuantity))} sold`
                            : "No recent sales signal"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Last 30 days of order activity.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div
                        className={`rounded-2xl border px-4 py-4 ${getDemandInsightPanelClassName(
                          demandAlignment,
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Demand Insight
                            </p>
                            <p className="mt-2 text-sm font-medium text-ink">
                              {getDemandInsightMessage(demandAlignment)}
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                              Sales signal: {formatNumber(String(salesSignalQuantity))} sold
                              {" | "}
                              Actual output: {formatNumber(batch.actualOutputQuantity)}{" "}
                              {batch.producedInventoryItem.unitOfMeasure}
                            </p>
                          </div>

                          <StatusChip tone={getDemandInsightTone(demandAlignment)}>
                            {demandAlignment === "under"
                              ? "Demand warning"
                              : demandAlignment === "over"
                                ? "Demand check"
                                : "Demand aligned"}
                          </StatusChip>
                        </div>
                      </div>

                      <div className="ui-subtle-panel">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Suggested Action
                        </p>
                        <p className="mt-2 text-sm font-medium text-ink">
                          {getSuggestedActionMessage(
                            demandAlignment,
                            adjustmentQuantity,
                          )}
                        </p>
                      </div>
                    </div>

                    {batch.notes ? (
                      <p className="mt-3 text-sm text-slate-600">{batch.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Selected recipe</h3>

            {!selectedRecipe ? (
              <p className="mt-4 text-sm text-slate-600">
                No active recipe is available yet.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="ui-subtle-panel">
                  <p className="font-medium text-ink">
                    {selectedRecipe.menuItem.name} | Recipe v{selectedRecipe.version}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Output: {selectedRecipe.producedInventoryItem.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Yield: {formatNumber(selectedRecipe.yieldQuantity)}{" "}
                    {selectedRecipe.producedInventoryItem.unitOfMeasure}
                  </p>
                  {selectedRecipe.instructions ? (
                    <p className="mt-3 text-sm text-slate-600">
                      {selectedRecipe.instructions}
                    </p>
                  ) : null}
                </div>

                <div className="ui-subtle-panel">
                  <p className="text-sm font-medium text-ink">Ingredients</p>
                  <div className="mt-3 divide-y divide-line/70">
                    {selectedRecipe.recipeItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 py-2 text-sm text-slate-700"
                      >
                        <span>{item.inventoryItem.name}</span>
                        <span>
                          {formatNumber(item.quantityRequired)}{" "}
                          {item.inventoryItem.unitOfMeasure}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Sales pull from finished goods
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Demand signal from the last 30 days so production can be read next to
                  what sales are actually moving.
                </p>
              </div>
              <div className="ui-subtle-panel text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Sales signal
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {formatNumber(String(soldQuantityTotal))} sold
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatCurrency(salesReport?.summary.totalSales ?? null)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {isLoading ? (
                <p className="text-sm text-slate-600">Loading sales signal...</p>
              ) : null}

              {!isLoading && (salesReport?.topSellingMenuItems.length ?? 0) === 0 ? (
                <div className="ui-row text-sm text-slate-600">
                  No recent sales activity available yet.
                </div>
              ) : null}

              {salesReport?.topSellingMenuItems.map((item) => (
                <div key={item.menuItemId} className="ui-row">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink">{item.menuItemName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatNumber(item.quantitySold)} sold in recent orders
                      </p>
                    </div>
                    <StatusChip tone="primary">
                      {formatCurrency(item.salesTotal)}
                    </StatusChip>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Plan production batch</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create the batch with an expected output so variance can be measured
              later.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleCreateBatch}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Active recipe
                </span>
                <select
                  name="recipeId"
                  value={createForm.recipeId}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                  required
                >
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.menuItem.name} | v{recipe.version} |{" "}
                      {recipe.producedInventoryItem.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Batch date
                </span>
                <input
                  type="datetime-local"
                  name="batchDate"
                  value={createForm.batchDate}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Planned output quantity
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  name="plannedOutputQuantity"
                  value={createForm.plannedOutputQuantity}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                  placeholder="Optional"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Batch number
                </span>
                <input
                  type="text"
                  name="batchNumber"
                  value={createForm.batchNumber}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                  placeholder="Optional"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Notes
                </span>
                <textarea
                  name="notes"
                  value={createForm.notes}
                  onChange={handleCreateFieldChange}
                  className="ui-textarea min-h-28"
                  placeholder="Optional batch note"
                />
              </label>

              <Button
                type="submit"
                disabled={isCreating || !selectedRecipe}
                fullWidth
              >
                {isCreating ? "Creating batch..." : "Create batch"}
              </Button>
            </form>
          </div>

          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Post actual output</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Complete any planned or in-progress batch with the final output quantity.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleCompleteBatch}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Open batch
                </span>
                <select
                  name="batchId"
                  value={completeForm.batchId}
                  onChange={handleCompleteFieldChange}
                  className="ui-input"
                  required
                >
                  <option value="" disabled>
                    {openBatches.length === 0
                      ? "No open batches"
                      : "Select a batch"}
                  </option>
                  {openBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batchNumber ?? batch.id} | {batch.menuItem.name} |{" "}
                      {formatStatus(batch.status)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedBatch ? (
                <div className="ui-subtle-panel text-sm text-slate-700">
                  <p>
                    Output item: {selectedBatch.producedInventoryItem.name}
                  </p>
                  <p className="mt-1">
                    Planned output:{" "}
                    {selectedBatch.plannedOutputQuantity
                      ? `${formatNumber(selectedBatch.plannedOutputQuantity)} ${selectedBatch.producedInventoryItem.unitOfMeasure}`
                      : "Not set"}
                  </p>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Completed at
                </span>
                <input
                  type="datetime-local"
                  name="completedAt"
                  value={completeForm.completedAt}
                  onChange={handleCompleteFieldChange}
                  className="ui-input"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Actual output quantity
                </span>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  name="actualOutputQuantity"
                  value={completeForm.actualOutputQuantity}
                  onChange={handleCompleteFieldChange}
                  className="ui-input"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Notes
                </span>
                <textarea
                  name="notes"
                  value={completeForm.notes}
                  onChange={handleCompleteFieldChange}
                  className="ui-textarea min-h-28"
                  placeholder="Optional completion note"
                />
              </label>

              <Button
                type="submit"
                disabled={isCompleting || openBatches.length === 0}
                fullWidth
              >
                {isCompleting ? "Completing batch..." : "Complete batch"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
