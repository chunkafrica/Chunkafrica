"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StoreStateCard } from "@/components/store-state-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { useActiveStore } from "@/lib/store-context";

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "TRANSFER",
  "OTHER",
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type OrderRecord = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  orderedAt: string;
  total: string;
  items: Array<{
    id: string;
    quantity: string;
    unitPrice: string;
    menuItem: {
      name: string;
    };
  }>;
  receipts: Array<{
    id: string;
    receiptNumber: string;
    issuedAt: string;
    amountPaid: string;
    paymentMethod: PaymentMethod;
  }>;
  paidAmount: string;
  outstandingBalance: string;
  receiptsSummary: {
    count: number;
    totalPaid: string;
    outstandingBalance: string;
  };
};

type ReceiptResponse = {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  amountPaid: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  runningPaidTotal: string;
  outstandingBalance: string;
  salesOrder: {
    id: string;
    orderNumber: string;
    total: string;
  };
};

type ReceiptLedgerEntry = {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  amountPaid: string;
  paymentMethod: PaymentMethod;
  orderId: string;
  orderNumber: string;
};

type RecordPaymentFormState = {
  orderId: string;
  issuedAt: string;
  amountPaid: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  notes: string;
};

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

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
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

function getFinancePaymentTone(value: string) {
  if (value === "PAID") {
    return "success" as const;
  }

  if (value === "PARTIALLY_PAID") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export default function FinanceOpsPage() {
  const {
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
  } = useActiveStore();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [paymentForm, setPaymentForm] = useState<RecordPaymentFormState>({
    orderId: "",
    issuedAt: formatDateTimeLocalInput(),
    amountPaid: "",
    paymentMethod: "CASH",
    paymentReference: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const payableOrders = orders.filter((order) => Number(order.outstandingBalance) > 0);
  const selectedPaymentOrder =
    orders.find((order) => order.id === paymentForm.orderId) ?? null;
  const receiptLedger = orders
    .flatMap<ReceiptLedgerEntry>((order) =>
      order.receipts.map((receipt) => ({
        ...receipt,
        orderId: order.id,
        orderNumber: order.orderNumber,
      })),
    )
    .sort(
      (left, right) =>
        new Date(right.issuedAt).getTime() - new Date(left.issuedAt).getTime(),
    );

  const totalBilled = orders.reduce((total, order) => total + Number(order.total), 0);
  const totalCollected = orders.reduce(
    (total, order) => total + Number(order.paidAmount),
    0,
  );
  const totalOutstanding = orders.reduce(
    (total, order) => total + Number(order.outstandingBalance),
    0,
  );

  async function loadFinanceView() {
    if (!activeStoreId) {
      setOrders([]);
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.get<OrderRecord[]>(`/stores/${activeStoreId}/orders`);
      setOrders(response.data);

      setPaymentForm((current) => {
        const payableOrder =
          response.data.find((entry) => entry.id === current.orderId) ??
          response.data.find((entry) => Number(entry.outstandingBalance) > 0);

        return {
          ...current,
          orderId: payableOrder?.id ?? "",
          amountPaid: current.amountPaid || payableOrder?.outstandingBalance || "",
        };
      });

      return response.data;
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isResolvingStore) {
      return;
    }

    if (!activeStoreId) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    void loadFinanceView();
  }, [activeStoreId, isResolvingStore]);

  function handlePaymentFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setPaymentForm((current) => {
      if (name === "orderId") {
        const order = orders.find((entry) => entry.id === value);

        return {
          ...current,
          orderId: value,
          amountPaid: order?.outstandingBalance ?? "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  async function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeStoreId) {
      setErrorMessage("Select an active store before recording payment.");
      return;
    }

    if (!paymentForm.orderId) {
      setErrorMessage("Choose an invoice to record payment for.");
      return;
    }

    setIsRecordingPayment(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        issuedAt: new Date(paymentForm.issuedAt).toISOString(),
        amountPaid: Number(paymentForm.amountPaid),
        paymentMethod: paymentForm.paymentMethod,
        paymentReference: paymentForm.paymentReference.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
      };

      const response = await api.post<ReceiptResponse>(
        `/orders/${paymentForm.orderId}/receipts`,
        payload,
      );

      const refreshed = await loadFinanceView();
      const nextPayableOrder = refreshed.find(
        (order) =>
          order.id !== paymentForm.orderId && Number(order.outstandingBalance) > 0,
      );

      setPaymentForm({
        orderId: nextPayableOrder?.id ?? "",
        issuedAt: formatDateTimeLocalInput(),
        amountPaid: nextPayableOrder?.outstandingBalance ?? "",
        paymentMethod: "CASH",
        paymentReference: "",
        notes: "",
      });

      setSuccessMessage(
        `Receipt ${response.data.receiptNumber} recorded for ${response.data.salesOrder.orderNumber}.`,
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsRecordingPayment(false);
    }
  }

  if (isResolvingStore) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Finance Ops"
          title="What has been billed, collected, and what is still outstanding?"
          description="Keep invoice visibility explicit: open balances, receipts posted, and what still needs collection."
        />
        <StoreStateCard
          title="Resolving active store"
          description="Chunk is loading the active store before requesting finance data."
        />
      </section>
    );
  }

  if (!activeStoreId) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Finance Ops"
          title="What has been billed, collected, and what is still outstanding?"
          description="Keep invoice visibility explicit: open balances, receipts posted, and what still needs collection."
        />
        <StoreStateCard
          title={storeErrorMessage ? "Unable to load stores" : "No active store found"}
          description={
            storeErrorMessage ??
            "Create or activate a store first. Finance Ops requests stay paused until a real store is selected."
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Finance Ops"
        title="Which sales are billed, collected, or still open?"
        description={`Make invoice visibility explicit without changing the working backend model${activeStore ? ` for ${activeStore.name}` : ""}. In Phase 1, sales orders act as the invoice source and receipts track collections against them.`}
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
            Billed value
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : formatCurrency(String(totalBilled))}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Total sales order value currently visible in finance.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Collected
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : formatCurrency(String(totalCollected))}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Cash already recorded against those invoices.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Outstanding
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : formatCurrency(String(totalOutstanding))}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Value still waiting to be collected.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payable invoices
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {isLoading ? "..." : payableOrders.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Sales orders with an open balance.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Open invoices from sales orders
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Every card shows what has been billed, what has been paid, and what
                  is still open.
                </p>
              </div>
              <Button
                onClick={() => void loadFinanceView()}
                variant="secondary"
                size="sm"
              >
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="text-sm text-slate-600">Loading invoice visibility...</p>
              ) : null}

              {!isLoading && payableOrders.length === 0 ? (
                <div className="ui-row text-sm text-slate-600">
                  No open invoice balances right now.
                </div>
              ) : null}

              {payableOrders.map((order) => (
                <div key={order.id} className="ui-row">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink">{order.orderNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDateTime(order.orderedAt)}
                      </p>
                    </div>
                    <StatusChip tone={getFinancePaymentTone(order.paymentStatus)}>
                      {formatStatus(order.paymentStatus)}
                    </StatusChip>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="ui-stat">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Billed
                      </p>
                      <p className="mt-1 font-semibold text-ink">
                        {formatCurrency(order.total)}
                      </p>
                    </div>

                    <div className="ui-stat">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Collected
                      </p>
                      <p className="mt-1 font-semibold text-ink">
                        {formatCurrency(order.paidAmount)}
                      </p>
                    </div>

                    <div className="ui-stat">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Open balance
                      </p>
                      <p className="mt-1 font-semibold text-ink">
                        {formatCurrency(order.outstandingBalance)}
                      </p>
                    </div>

                    <div className="ui-stat">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Receipts posted
                      </p>
                      <p className="mt-1 font-semibold text-ink">
                        {formatNumber(String(order.receiptsSummary.count))}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    Items: {order.items.map((item) => item.menuItem.name).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Recent receipts</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Collection entries are surfaced here so finance review is not buried
              inside the sales page.
            </p>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="text-sm text-slate-600">Loading receipts...</p>
              ) : null}

              {!isLoading && receiptLedger.length === 0 ? (
                <div className="ui-row text-sm text-slate-600">
                  No receipts have been recorded yet.
                </div>
              ) : null}

              {receiptLedger.slice(0, 10).map((receipt) => (
                <div key={receipt.id} className="ui-row">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink">{receipt.receiptNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {receipt.orderNumber} | {formatDateTime(receipt.issuedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">
                        {formatCurrency(receipt.amountPaid)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                        {formatStatus(receipt.paymentMethod)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Record receipt</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Post collections directly against any invoice that still has an open
              balance.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleRecordPayment}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Open invoice
                </span>
                <select
                  name="orderId"
                  value={paymentForm.orderId}
                  onChange={handlePaymentFieldChange}
                  className="ui-input"
                  required
                >
                  <option value="" disabled>
                    {payableOrders.length === 0
                      ? "No open invoices"
                      : "Select an invoice"}
                  </option>
                  {payableOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} | {formatCurrency(order.outstandingBalance)} due
                    </option>
                  ))}
                </select>
              </label>

              {selectedPaymentOrder ? (
                <div className="ui-subtle-panel text-sm text-slate-700">
                  <p>Billed: {formatCurrency(selectedPaymentOrder.total)}</p>
                  <p className="mt-1">
                    Collected: {formatCurrency(selectedPaymentOrder.paidAmount)}
                  </p>
                  <p className="mt-1">
                    Open balance:{" "}
                    {formatCurrency(selectedPaymentOrder.outstandingBalance)}
                  </p>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Issued at
                </span>
                <input
                  type="datetime-local"
                  name="issuedAt"
                  value={paymentForm.issuedAt}
                  onChange={handlePaymentFieldChange}
                  className="ui-input"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Amount received
                </span>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  name="amountPaid"
                  value={paymentForm.amountPaid}
                  onChange={handlePaymentFieldChange}
                  className="ui-input"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Payment method
                </span>
                <select
                  name="paymentMethod"
                  value={paymentForm.paymentMethod}
                  onChange={handlePaymentFieldChange}
                  className="ui-input"
                  required
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {formatStatus(method)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Payment reference
                </span>
                <input
                  type="text"
                  name="paymentReference"
                  value={paymentForm.paymentReference}
                  onChange={handlePaymentFieldChange}
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
                  value={paymentForm.notes}
                  onChange={handlePaymentFieldChange}
                  className="ui-textarea"
                  placeholder="Optional receipt note"
                />
              </label>

              <Button
                type="submit"
                disabled={isRecordingPayment || payableOrders.length === 0}
                fullWidth
              >
                {isRecordingPayment ? "Recording receipt..." : "Record receipt"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
