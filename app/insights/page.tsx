"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StoreStateCard } from "@/components/store-state-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { useActiveStore } from "@/lib/store-context";

type OrderFinanceRecord = {
  id: string;
  total: string;
  paidAmount: string;
  outstandingBalance: string;
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

type WasteReportResponse = {
  summary: {
    totalLogs: number;
    totalWasteQuantity: string;
    totalCostAtLoss: string;
  };
  byCategory: Array<{
    wasteCategoryId: string;
    wasteCategoryName: string;
    logs: number;
    quantity: string;
    costAtLoss: string;
  }>;
};

type VarianceReportResponse = {
  summary: {
    postedSessions: number;
    varianceAdjustments: number;
    positiveAdjustments: string;
    negativeAdjustments: string;
    netVarianceQuantity: string;
  };
  alerts: Array<{
    id: string;
    occurredAt: string;
    quantityChange: string;
    inventoryItem: {
      name: string;
      unitOfMeasure: string;
    } | null;
  }>;
};

type InsightsViewData = {
  salesReport: SalesReportResponse;
  wasteReport: WasteReportResponse;
  varianceReport: VarianceReportResponse;
  orders: OrderFinanceRecord[];
  rangeLabel: string;
};

function getLast30DayRange() {
  const to = new Date();
  const from = new Date();

  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: "Last 30 days",
  };
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export default function InsightsPage() {
  const {
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
  } = useActiveStore();
  const [insights, setInsights] = useState<InsightsViewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadInsights() {
    if (!activeStoreId) {
      setInsights(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { from, to, label } = getLast30DayRange();
      const [salesResponse, wasteResponse, varianceResponse, ordersResponse] =
        await Promise.all([
          api.get<SalesReportResponse>(`/stores/${activeStoreId}/reports/sales`, {
            params: { from, to },
          }),
          api.get<WasteReportResponse>(`/stores/${activeStoreId}/reports/waste`, {
            params: { from, to },
          }),
          api.get<VarianceReportResponse>(
            `/stores/${activeStoreId}/reports/reconciliation-variance`,
            {
              params: { from, to },
            },
          ),
          api.get<OrderFinanceRecord[]>(`/stores/${activeStoreId}/orders`, {
            params: { from, to },
          }),
        ]);

      setInsights({
        salesReport: salesResponse.data,
        wasteReport: wasteResponse.data,
        varianceReport: varianceResponse.data,
        orders: ordersResponse.data,
        rangeLabel: label,
      });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isResolvingStore) {
      return;
    }

    if (!activeStoreId) {
      setInsights(null);
      setIsLoading(false);
      return;
    }

    void loadInsights();
  }, [activeStoreId, isResolvingStore]);

  const totalBooked = insights?.orders.reduce((total, order) => {
    return total + Number(order.total);
  }, 0) ?? 0;
  const totalCollected = insights?.orders.reduce((total, order) => {
    return total + Number(order.paidAmount);
  }, 0) ?? 0;
  const totalExpected = insights?.orders.reduce((total, order) => {
    return total + Number(order.outstandingBalance);
  }, 0) ?? 0;
  const collectionRate =
    totalBooked > 0 ? Math.min(100, (totalCollected / totalBooked) * 100) : 0;

  if (isResolvingStore) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Insights"
          title="Where is revenue landing, and where is value leaking?"
          description="Lightweight operating insight for the current business: expected versus collected revenue, leakage and variance alerts, and the products pulling the most value."
        />
        <StoreStateCard
          title="Resolving active store"
          description="Chunk is loading the active store before requesting insight data."
        />
      </section>
    );
  }

  if (!activeStoreId) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Insights"
          title="Where is revenue landing, and where is value leaking?"
          description="Lightweight operating insight for the current business: expected versus collected revenue, leakage and variance alerts, and the products pulling the most value."
        />
        <StoreStateCard
          title={storeErrorMessage ? "Unable to load stores" : "No active store found"}
          description={
            storeErrorMessage ??
            "Create or activate a store first. Insight requests stay paused until a real store is selected."
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Where is revenue landing, and where is value leaking?"
        description={`Lightweight operating insight${activeStore ? ` for ${activeStore.name}` : ""}: expected versus collected revenue, leakage and variance alerts, and the products pulling the most value.`}
        action={
          <Button
            onClick={() => void loadInsights()}
            variant="secondary"
          >
            Refresh insights
          </Button>
        }
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Revenue booked
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : formatCurrency(String(totalBooked))}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Sales value captured in the selected period.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Collected revenue
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : formatCurrency(String(totalCollected))}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Cash already received against booked revenue.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Still expected
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : formatCurrency(String(totalExpected))}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Revenue still open on current sales orders.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Collection rate
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : `${formatNumber(String(collectionRate))}%`}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            How much of booked revenue has already landed.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Revenue versus expected collection
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {insights?.rangeLabel ?? "Loading range..."} of booked sales compared
                  with cash already collected.
                </p>
              </div>
              <div className="ui-subtle-panel text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Avg order value
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {formatCurrency(insights?.salesReport.summary.averageOrderValue ?? null)}
                </p>
              </div>
            </div>

            <div className="ui-subtle-panel mt-6">
              <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
                <span>Collected</span>
                <span>{formatCurrency(String(totalCollected))}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600">
                <span>Still expected</span>
                <span>{formatCurrency(String(totalExpected))}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="ui-subtle-panel">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Orders captured
                </p>
                <p className="mt-2 text-xl font-semibold text-ink">
                  {isLoading
                    ? "..."
                    : formatNumber(String(insights?.salesReport.summary.totalOrders ?? 0))}
                </p>
              </div>

              <div className="ui-subtle-panel">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Sales report total
                </p>
                <p className="mt-2 text-xl font-semibold text-ink">
                  {formatCurrency(insights?.salesReport.summary.totalSales ?? null)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Leakage and variance watch</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Waste cost and reconciliation variance surfaced together so leakage is
              visible in one place.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="ui-subtle-panel">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Cost at loss
                </p>
                <p className="mt-2 font-semibold text-ink">
                  {formatCurrency(insights?.wasteReport.summary.totalCostAtLoss ?? null)}
                </p>
              </div>

              <div className="ui-subtle-panel">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Waste logs
                </p>
                <p className="mt-2 font-semibold text-ink">
                  {formatNumber(String(insights?.wasteReport.summary.totalLogs ?? 0))}
                </p>
              </div>

              <div className="ui-subtle-panel">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Negative variance
                </p>
                <p className="mt-2 font-semibold text-ink">
                  {formatNumber(
                    insights?.varianceReport.summary.negativeAdjustments ?? null,
                  )}
                </p>
              </div>

              <div className="ui-subtle-panel">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Variance alerts
                </p>
                <p className="mt-2 font-semibold text-ink">
                  {formatNumber(
                    String(insights?.varianceReport.summary.varianceAdjustments ?? 0),
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="ui-subtle-panel">
                <h4 className="text-sm font-semibold text-ink">Top waste categories</h4>
                <div className="mt-3 divide-y divide-line/70">
                  {(insights?.wasteReport.byCategory.slice(0, 3) ?? []).map((category) => (
                    <div
                      key={category.wasteCategoryId}
                      className="flex items-start justify-between gap-4 py-3 text-sm text-slate-700"
                    >
                      <div>
                        <p className="font-medium text-ink">{category.wasteCategoryName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatNumber(String(category.logs))} log(s)
                        </p>
                      </div>
                      <span>{formatCurrency(category.costAtLoss)}</span>
                    </div>
                  ))}

                  {!isLoading &&
                  (insights?.wasteReport.byCategory.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-600">No waste categories recorded.</p>
                  ) : null}
                </div>
              </div>

              <div className="ui-subtle-panel">
                <h4 className="text-sm font-semibold text-ink">Recent variance alerts</h4>
                <div className="mt-3 space-y-3">
                  {(insights?.varianceReport.alerts.slice(0, 6) ?? []).map((alert) => (
                    <div
                      key={alert.id}
                      className="ui-row bg-background"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-ink">
                            {alert.inventoryItem?.name ?? "Inventory variance"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatDateTime(alert.occurredAt)}
                          </p>
                        </div>
                        <StatusChip tone="danger">
                          {formatNumber(alert.quantityChange)}
                          {alert.inventoryItem ? ` ${alert.inventoryItem.unitOfMeasure}` : ""}
                        </StatusChip>
                      </div>
                    </div>
                  ))}

                  {!isLoading &&
                  (insights?.varianceReport.alerts.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-600">
                      No recent variance alerts in the selected range.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Top product performance</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Products generating the strongest sales pull in the selected period.
            </p>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="text-sm text-slate-600">Loading product performance...</p>
              ) : null}

              {!isLoading &&
              (insights?.salesReport.topSellingMenuItems.length ?? 0) === 0 ? (
                <div className="ui-row text-sm text-slate-600">
                  No product sales signal available yet.
                </div>
              ) : null}

              {insights?.salesReport.topSellingMenuItems.map((item, index) => (
                <div key={item.menuItemId} className="ui-row">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                        Top {index + 1}
                      </p>
                      <p className="mt-1 font-medium text-ink">{item.menuItemName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatNumber(item.quantitySold)} sold
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">
                        {formatCurrency(item.salesTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
