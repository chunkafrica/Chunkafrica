"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { subscribeToOperationsSync } from "@/lib/operations-sync";
import { StoreStateCard } from "@/components/store-state-card";
import { Button } from "@/components/ui/button";
import { MetricBox } from "@/components/ui/metric-box";
import { PageHeader } from "@/components/ui/page-header";
import { SectionContainer } from "@/components/ui/section-container";
import { StatusChip } from "@/components/ui/status-chip";
import { useActiveStore } from "@/lib/store-context";

type DashboardOverviewResponse = {
  range: {
    from: string;
    to: string;
  };
  totals: {
    sales: string;
    orders: number;
    expenses: string;
  };
  lowStockItems: LowStockItem[];
  recentStockIns: StockInActivity[];
  recentProductionBatches: ProductionActivity[];
  recentWasteLogs: WasteActivity[];
  recentReconciliations: ReconciliationActivity[];
  topSellingMenuItems: Array<{
    menuItemId: string;
    menuItemName: string;
    quantitySold: string;
    salesTotal: string;
  }>;
  recentVarianceAlerts: Array<{
    id: string;
    occurredAt: string;
    quantityChange: string;
  }>;
};

type LowStockItem = {
  id: string;
  name: string;
  unitOfMeasure: string;
  restockPoint: string | null;
  onHandQuantity: string;
  lastMovementAt: string | null;
  lowStock: boolean;
};

type StockInActivity = {
  id: string;
  receivedAt: string;
  supplier: {
    name: string;
  } | null;
  _count: {
    items: number;
  };
};

type ProductionActivity = {
  id: string;
  batchNumber: string | null;
  batchDate: string;
  plannedOutputQuantity: string | null;
  actualOutputQuantity: string;
  status: string;
  menuItem: {
    id: string;
    name: string;
  };
  producedInventoryItem: {
    name: string;
    unitOfMeasure: string;
  };
};

type WasteActivity = {
  id: string;
  occurredAt: string;
  quantity: string;
  inventoryItem: {
    name: string;
    unitOfMeasure: string;
  };
  wasteCategory: {
    name: string;
  };
};

type ReconciliationActivity = {
  id: string;
  startedAt: string;
  status: string;
  _count: {
    items: number;
  };
};

type ActivityFeedItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  occurredAt: string;
};

type AlertTone = "success" | "warning" | "danger" | "neutral";

type OperatingAlert = {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: AlertTone;
};

type HealthSummaryMetric = {
  label: string;
  value: string;
  detail: string;
  tone: AlertTone;
};

function getTodayRange() {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatNumber(value: string) {
  return new Intl.NumberFormat("en-NG", {
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

function buildRecentActivity(data: DashboardOverviewResponse): ActivityFeedItem[] {
  const stockIns = data.recentStockIns.map((entry) => ({
    id: `stock-in-${entry.id}`,
    kind: "Stock In",
    title: entry.supplier?.name
      ? `Stock received from ${entry.supplier.name}`
      : "Stock received",
    detail: `${entry._count.items} item line${entry._count.items === 1 ? "" : "s"}`,
    occurredAt: entry.receivedAt,
  }));

  const batches = data.recentProductionBatches.map((entry) => ({
    id: `batch-${entry.id}`,
    kind: "Production",
    title: entry.batchNumber
      ? `Batch ${entry.batchNumber}`
      : `${entry.menuItem.name} batch`,
    detail: `${formatNumber(entry.actualOutputQuantity)} ${entry.producedInventoryItem.unitOfMeasure} | ${formatStatus(entry.status)}`,
    occurredAt: entry.batchDate,
  }));

  const wasteLogs = data.recentWasteLogs.map((entry) => ({
    id: `waste-${entry.id}`,
    kind: "Waste",
    title: `${entry.inventoryItem.name} logged as waste`,
    detail: `${formatNumber(entry.quantity)} ${entry.inventoryItem.unitOfMeasure} | ${entry.wasteCategory.name}`,
    occurredAt: entry.occurredAt,
  }));

  const reconciliations = data.recentReconciliations.map((entry) => ({
    id: `reconciliation-${entry.id}`,
    kind: "Reconciliation",
    title: `Inventory reconciliation ${formatStatus(entry.status)}`,
    detail: `${entry._count.items} counted item${entry._count.items === 1 ? "" : "s"}`,
    occurredAt: entry.startedAt,
  }));

  return [...stockIns, ...batches, ...wasteLogs, ...reconciliations]
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )
    .slice(0, 8);
}

function getAlertDotClassName(tone: AlertTone) {
  if (tone === "danger") {
    return "bg-danger";
  }

  if (tone === "warning") {
    return "bg-warning";
  }

  if (tone === "success") {
    return "bg-success";
  }

  return "bg-slate-400";
}

function getRecentBatchVarianceSignals(data: DashboardOverviewResponse) {
  return data.recentProductionBatches.filter((batch) => {
    if (batch.status !== "COMPLETED" || !batch.plannedOutputQuantity) {
      return false;
    }

    return Number(batch.actualOutputQuantity) !== Number(batch.plannedOutputQuantity);
  });
}

function getDemandPressureSignals(data: DashboardOverviewResponse) {
  const actualOutputByMenuItemId = data.recentProductionBatches.reduce(
    (accumulator, batch) => {
      if (batch.status === "CANCELLED") {
        return accumulator;
      }

      const current = accumulator.get(batch.menuItem.id) ?? 0;
      accumulator.set(
        batch.menuItem.id,
        current + Number(batch.actualOutputQuantity),
      );
      return accumulator;
    },
    new Map<string, number>(),
  );

  return data.topSellingMenuItems
    .map((item) => {
      const actualOutput = actualOutputByMenuItemId.get(item.menuItemId) ?? 0;
      const salesSignal = Number(item.quantitySold);
      const gap = salesSignal - actualOutput;

      return {
        ...item,
        actualOutput,
        salesSignal,
        gap,
      };
    })
    .filter(
      (item) =>
        item.salesSignal > item.actualOutput &&
        item.gap >= Math.max(1, item.actualOutput * 0.1),
    );
}

function buildOperatingAlerts(data: DashboardOverviewResponse): OperatingAlert[] {
  const lowStockAlerts = data.lowStockItems.map((item) => ({
    id: `low-stock-${item.id}`,
    label: "Stock",
    title: `${item.name} running low`,
    detail: `On hand ${formatNumber(item.onHandQuantity)} ${item.unitOfMeasure} against a restock point of ${formatNumber(item.restockPoint ?? "0")} ${item.unitOfMeasure}.`,
    tone: "warning" as const,
  }));

  const productionVarianceAlerts = getRecentBatchVarianceSignals(data).map((batch) => {
    const variance =
      Number(batch.actualOutputQuantity) - Number(batch.plannedOutputQuantity ?? "0");

    return {
      id: `production-variance-${batch.id}`,
      label: "Production",
      title: "Production variance detected",
      detail: `${batch.batchNumber ?? batch.menuItem.name} is ${variance < 0 ? "under plan" : "off plan"} by ${formatNumber(String(Math.abs(variance)))} ${batch.producedInventoryItem.unitOfMeasure}.`,
      tone: variance < 0 ? ("danger" as const) : ("warning" as const),
    };
  });

  const demandAlerts = getDemandPressureSignals(data).map((item) => ({
    id: `demand-pressure-${item.menuItemId}`,
    label: "Demand",
    title: "Demand exceeds production",
    detail: `${item.menuItemName} has ${formatNumber(item.quantitySold)} sold against ${formatNumber(String(item.actualOutput))} produced in recent dashboard activity.`,
    tone: "danger" as const,
  }));

  return [...lowStockAlerts, ...productionVarianceAlerts, ...demandAlerts].slice(0, 8);
}

function buildBusinessHealthSummary(data: DashboardOverviewResponse): HealthSummaryMetric[] {
  const lowStockCount = data.lowStockItems.length;
  const varianceSignals = getRecentBatchVarianceSignals(data);
  const demandSignals = getDemandPressureSignals(data);
  const soldQuantityTotal = data.topSellingMenuItems.reduce((total, item) => {
    return total + Number(item.quantitySold);
  }, 0);

  const productionStatus = varianceSignals.length > 0 || demandSignals.length > 0 ? "Risk" : "Good";
  const stockPressure =
    lowStockCount >= 3 ? "High" : lowStockCount >= 1 ? "Medium" : "Low";
  const salesTrend =
    data.totals.orders === 0
      ? "Down"
      : data.totals.orders >= 5 || soldQuantityTotal >= 10
        ? "Up"
        : "Stable";

  return [
    {
      label: "Production status",
      value: productionStatus,
      detail:
        productionStatus === "Risk"
          ? "Recent batches show variance or demand is pulling ahead of output."
          : "Recent batch activity is tracking without immediate production risk.",
      tone: productionStatus === "Risk" ? "danger" : "success",
    },
    {
      label: "Stock pressure",
      value: stockPressure,
      detail:
        stockPressure === "High"
          ? "Multiple low-stock items are likely to constrain operations."
          : stockPressure === "Medium"
            ? "Some inventory lines need attention soon."
            : "Current low-stock pressure is manageable.",
      tone:
        stockPressure === "High"
          ? "danger"
          : stockPressure === "Medium"
            ? "warning"
            : "success",
    },
    {
      label: "Sales trend",
      value: salesTrend,
      detail:
        salesTrend === "Up"
          ? "Today's order count and product pull suggest strong demand."
          : salesTrend === "Down"
            ? "Sales activity is quiet in the current range."
            : "Demand is moving, but not sharply up or down.",
      tone:
        salesTrend === "Up"
          ? "success"
          : salesTrend === "Down"
            ? "danger"
            : "neutral",
    },
  ];
}

export default function DashboardPage() {
  const {
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
  } = useActiveStore();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadDashboard(options?: {
    silent?: boolean;
    preserveMessages?: boolean;
  }) {
    if (!activeStoreId) {
      setDashboard(null);
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
        const { from, to } = getTodayRange();
        const response = await api.get<DashboardOverviewResponse>(
        `/stores/${activeStoreId}/dashboard/overview`,
          {
            params: { from, to },
          },
        );

      setDashboard(response.data);
    } catch (error) {
      if (!options?.silent) {
        const message =
          error instanceof Error
            ? error.message
            : "Dashboard could not be loaded.";

        setErrorMessage(message);
      }
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
      setDashboard(null);
      setIsLoading(false);
      return;
    }

    void loadDashboard();
  }, [activeStoreId, isResolvingStore]);

  useEffect(() => {
    if (!activeStoreId) {
      return;
    }

    return subscribeToOperationsSync((event) => {
      if (event.kind !== "production-batch-completed") {
        return;
      }

      void loadDashboard({ silent: true, preserveMessages: true });
    });
  }, [activeStoreId]);

  const recentActivity = dashboard ? buildRecentActivity(dashboard) : [];
  const topSellingItems = dashboard?.topSellingMenuItems ?? [];
  const varianceAlerts = dashboard?.recentVarianceAlerts ?? [];
  const operatingAlerts = dashboard ? buildOperatingAlerts(dashboard) : [];
  const businessHealthSummary = dashboard
    ? buildBusinessHealthSummary(dashboard)
    : [];

  if (isResolvingStore) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Dashboard"
          title="What is happening across operations today?"
          description="A clean operating snapshot of sales, stock pressure, live activity, product pull, and variance signals."
        />
        <StoreStateCard
          title="Resolving active store"
          description="Chunk is loading the active store before requesting dashboard data."
        />
      </section>
    );
  }

  if (!activeStoreId) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Dashboard"
          title="What is happening across operations today?"
          description="A clean operating snapshot of sales, stock pressure, live activity, product pull, and variance signals."
        />
        <StoreStateCard
          title={storeErrorMessage ? "Unable to load stores" : "No active store found"}
          description={
            storeErrorMessage ??
            "Create or activate a store first. Dashboard requests stay paused until a real store is available."
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="What is happening across operations today?"
        description={`A clean operating snapshot of sales, stock pressure, live activity, product pull, and variance signals${activeStore ? ` for ${activeStore.name}` : ""}.`}
        action={
          <Button
            onClick={() => void loadDashboard()}
            variant="secondary"
          >
            Refresh dashboard
          </Button>
        }
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricBox
          label="Sales today"
          value={
            isLoading && !dashboard
              ? "Loading..."
              : formatCurrency(dashboard?.totals.sales ?? "0")
          }
          detail={
            dashboard
              ? `${dashboard.totals.orders} order${dashboard.totals.orders === 1 ? "" : "s"} captured in the selected range.`
              : "Using today as the dashboard range."
          }
        />
        <MetricBox
          label="Orders"
          value={formatNumber(String(dashboard?.totals.orders ?? 0))}
          detail="How many sales entries are already on the books today."
        />
        <MetricBox
          label="Low stock"
          value={formatNumber(String(dashboard?.lowStockItems.length ?? 0))}
          detail="Items that are already at or below their restock point."
        />
        <MetricBox
          label="Variance alerts"
          value={formatNumber(String(varianceAlerts.length))}
          detail="Recent adjustment signals that may point to leakage."
        />
      </div>

      <SectionContainer
        title="Quick Actions"
        description="Jump straight into the most common operating tasks for the day."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Button
            onClick={() => router.push("/sales-ops")}
            className="w-full"
          >
            Log Sale
          </Button>
          <Button
            onClick={() => router.push("/production-ops")}
            variant="secondary"
            className="w-full"
          >
            Create Batch
          </Button>
          <Button
            onClick={() => router.push("/inventory-ops")}
            variant="secondary"
            className="w-full"
          >
            Add Stock
          </Button>
          <Button
            onClick={() => router.push("/waste")}
            variant="secondary"
            className="w-full"
          >
            Log Waste
          </Button>
        </div>
      </SectionContainer>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionContainer
          title="Operating Alerts"
          description="The fastest view of what needs attention across stock, production, and demand pressure."
          action={
            <span className="text-sm text-slate-500">
              {dashboard ? operatingAlerts.length : 0}
            </span>
          }
        >
          <div className="mt-4 space-y-3">
            {isLoading && !dashboard ? (
              <p className="text-sm text-slate-600">Loading operating alerts...</p>
            ) : null}

            {!isLoading && operatingAlerts.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">No active issues</div>
            ) : null}

            {operatingAlerts.map((alert) => (
              <div key={alert.id} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full ${getAlertDotClassName(
                        alert.tone,
                      )}`}
                    />
                    <div>
                      <p className="font-medium text-ink">{alert.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{alert.detail}</p>
                    </div>
                  </div>

                  <StatusChip tone={alert.tone}>{alert.label}</StatusChip>
                </div>
              </div>
            ))}
          </div>
        </SectionContainer>

        <SectionContainer
          title="Business Health Summary"
          description="A quick read on operational condition using lightweight signals from the current dashboard range."
        >
          <div className="mt-4 grid gap-3">
            {isLoading && !dashboard ? (
              <p className="text-sm text-slate-600">Loading business health...</p>
            ) : null}

            {businessHealthSummary.map((metric) => (
              <div key={metric.label} className="ui-subtle-panel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-ink">
                      {metric.value}
                    </p>
                  </div>

                  <StatusChip tone={metric.tone}>{metric.value}</StatusChip>
                </div>

                <p className="mt-3 text-sm text-slate-600">{metric.detail}</p>
              </div>
            ))}
          </div>
        </SectionContainer>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionContainer
          title="Low stock items"
          description="Inventory lines that need attention before they constrain production."
          action={
            <span className="text-sm text-slate-500">
              {dashboard?.lowStockItems.length ?? 0}
            </span>
          }
        >
          <div className="mt-4 space-y-3">
            {isLoading && !dashboard ? (
              <p className="text-sm text-slate-600">Loading low stock items...</p>
            ) : null}

            {!isLoading && dashboard?.lowStockItems.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">
                No low stock items for today.
              </div>
            ) : null}

            {dashboard?.lowStockItems.map((item) => (
              <div key={item.id} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      On hand: {formatNumber(item.onHandQuantity)} {item.unitOfMeasure}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Restock point: {formatNumber(item.restockPoint ?? "0")}{" "}
                      {item.unitOfMeasure}
                    </p>
                  </div>

                  <StatusChip tone="warning">Low stock</StatusChip>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  {item.lastMovementAt
                    ? `Last movement: ${formatDateTime(item.lastMovementAt)}`
                    : "No stock movement recorded yet."}
                </p>
              </div>
            ))}
          </div>
        </SectionContainer>

        <SectionContainer
          title="Recent activity"
          description="The latest operating events across stock, production, waste, and reconciliation."
          action={<span className="text-sm text-slate-500">{recentActivity.length}</span>}
        >
          <div className="mt-4 space-y-3">
            {isLoading && !dashboard ? (
              <p className="text-sm text-slate-600">Loading recent activity...</p>
            ) : null}

            {!isLoading && recentActivity.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">
                No activity recorded for today.
              </div>
            ) : null}

            {recentActivity.map((activity) => (
              <div key={activity.id} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                      {activity.kind}
                    </p>
                    <p className="mt-1 font-medium text-ink">{activity.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{activity.detail}</p>
                  </div>

                  <span className="whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(activity.occurredAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionContainer>

        <SectionContainer
          title="Top product performance"
          description="Which products are currently creating the strongest pull on operations."
        >
          <div className="mt-4 space-y-3">
            {isLoading && !dashboard ? (
              <p className="text-sm text-slate-600">Loading product performance...</p>
            ) : null}

            {!isLoading && topSellingItems.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">
                No top-selling product signal available yet.
              </div>
            ) : null}

            {topSellingItems.map((item) => (
              <div key={item.menuItemId} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{item.menuItemName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatNumber(item.quantitySold)} sold
                    </p>
                  </div>
                  <StatusChip tone="primary">{formatCurrency(item.salesTotal)}</StatusChip>
                </div>
              </div>
            ))}
          </div>
        </SectionContainer>

        <SectionContainer
          title="Recent variance watch"
          description="Fast view of adjustments that may signal leakage or control gaps."
        >
          <div className="mt-4 space-y-3">
            {isLoading && !dashboard ? (
              <p className="text-sm text-slate-600">Loading variance alerts...</p>
            ) : null}

            {!isLoading && varianceAlerts.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">
                No variance alerts recorded in the current range.
              </div>
            ) : null}

            {varianceAlerts.map((alert) => (
              <div key={alert.id} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">Inventory adjustment</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDateTime(alert.occurredAt)}
                    </p>
                  </div>
                  <StatusChip tone="danger">{formatNumber(alert.quantityChange)}</StatusChip>
                </div>
              </div>
            ))}
          </div>
        </SectionContainer>
      </div>
    </section>
  );
}
