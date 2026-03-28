"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StoreStateCard } from "@/components/store-state-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { useActiveStore } from "@/lib/store-context";

const SALES_CHANNELS = [
  "WALK_IN",
  "WHATSAPP",
  "INSTAGRAM",
  "WEBSITE",
  "CHOWDECK",
  "GLOVO",
  "EVENT",
] as const;

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "TRANSFER",
  "OTHER",
] as const;

type SalesChannel = (typeof SALES_CHANNELS)[number];
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type MenuItemOption = {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: string;
  isActive: boolean;
  _count?: {
    recipes: number;
  };
};

type OrderRecord = {
  id: string;
  orderNumber: string;
  channel: SalesChannel;
  orderStatus: string;
  paymentStatus: string;
  orderedAt: string;
  total: string;
  notes: string | null;
  items: Array<{
    id: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    menuItem: {
      name: string;
    };
    fulfilledInventoryItem: {
      name: string;
      unitOfMeasure: string;
    };
    stockMovement: {
      occurredAt: string;
    } | null;
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
  fulfillmentState: {
    isFulfilled: boolean;
    fulfilledAt: string | null;
    saleMovementCount: number;
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

type CreateOrderFormState = {
  menuItemId: string;
  productName: string;
  productPrice: string;
  quantity: string;
  channel: SalesChannel;
  orderedAt: string;
  notes: string;
};

type FulfillOrderFormState = {
  orderId: string;
  fulfilledAt: string;
  notes: string;
};

type RecordPaymentFormState = {
  orderId: string;
  issuedAt: string;
  amountPaid: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  notes: string;
};

type OrdersViewData = {
  menuItems: MenuItemOption[];
  orders: OrderRecord[];
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

function getOrderStatusTone(value: string) {
  if (value === "DELIVERED") {
    return "success" as const;
  }

  if (value === "CANCELLED") {
    return "danger" as const;
  }

  return "primary" as const;
}

function getPaymentStatusTone(value: string) {
  if (value === "PAID") {
    return "success" as const;
  }

  if (value === "PARTIALLY_PAID") {
    return "warning" as const;
  }

  return "neutral" as const;
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

export default function OrdersPage() {
  const {
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
  } = useActiveStore();
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [createForm, setCreateForm] = useState<CreateOrderFormState>({
    menuItemId: "",
    productName: "",
    productPrice: "",
    quantity: "1",
    channel: "WALK_IN",
    orderedAt: formatDateTimeLocalInput(),
    notes: "",
  });
  const [fulfillForm, setFulfillForm] = useState<FulfillOrderFormState>({
    orderId: "",
    fulfilledAt: formatDateTimeLocalInput(),
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState<RecordPaymentFormState>({
    orderId: "",
    issuedAt: formatDateTimeLocalInput(),
    amountPaid: "",
    paymentMethod: "CASH",
    paymentReference: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openOrders = orders.filter((order) => !order.fulfillmentState.isFulfilled);
  const payableOrders = orders.filter((order) => Number(order.outstandingBalance) > 0);
  const selectedMenuItem =
    menuItems.find((menuItem) => menuItem.id === createForm.menuItemId) ?? null;
  const normalizedProductName = createForm.productName.trim().toLowerCase();
  const matchingManualMenuItem =
    menuItems.find(
      (menuItem) => menuItem.name.trim().toLowerCase() === normalizedProductName,
    ) ?? null;
  const resolvedCreateMenuItem = selectedMenuItem ?? matchingManualMenuItem;
  const selectedFulfillOrder =
    orders.find((order) => order.id === fulfillForm.orderId) ?? null;
  const selectedPaymentOrder =
    orders.find((order) => order.id === paymentForm.orderId) ?? null;

  async function loadOrdersView(): Promise<OrdersViewData> {
    if (!activeStoreId) {
      setMenuItems([]);
      setOrders([]);
      setIsLoading(false);
      return {
        menuItems: [],
        orders: [],
      };
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [menuItemsResponse, ordersResponse] = await Promise.all([
        api.get<MenuItemOption[]>("/menu-items"),
        api.get<OrderRecord[]>(`/stores/${activeStoreId}/orders`),
      ]);

      setMenuItems(menuItemsResponse.data);
      setOrders(ordersResponse.data);

      setCreateForm((current) => ({
        ...current,
        menuItemId:
          menuItemsResponse.data.find((entry) => entry.id === current.menuItemId)?.id ??
          "",
      }));

      setFulfillForm((current) => ({
        ...current,
        orderId:
          ordersResponse.data.find((entry) => entry.id === current.orderId)?.id ??
          ordersResponse.data.find((entry) => !entry.fulfillmentState.isFulfilled)?.id ??
          "",
      }));

      setPaymentForm((current) => {
        const payableOrder =
          ordersResponse.data.find((entry) => entry.id === current.orderId) ??
          ordersResponse.data.find((entry) => Number(entry.outstandingBalance) > 0);

        return {
          ...current,
          orderId: payableOrder?.id ?? "",
          amountPaid: current.amountPaid || payableOrder?.outstandingBalance || "",
        };
      });

      return {
        menuItems: menuItemsResponse.data,
        orders: ordersResponse.data,
      };
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      return {
        menuItems: [],
        orders: [],
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
      setMenuItems([]);
      setOrders([]);
      setIsLoading(false);
      return;
    }

    void loadOrdersView();
  }, [activeStoreId, isResolvingStore]);

  function handleCreateFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setCreateForm((current) => {
      if (name === "menuItemId") {
        const nextMenuItem =
          menuItems.find((menuItem) => menuItem.id === value) ?? null;

        return {
          ...current,
          menuItemId: value,
          productName: value ? "" : current.productName,
          productPrice: value ? nextMenuItem?.defaultPrice ?? "" : current.productPrice,
        };
      }

      if (name === "productName") {
        return {
          ...current,
          productName: value,
          menuItemId: value.trim() ? "" : current.menuItemId,
        };
      }

      return { ...current, [name]: value };
    });
  }

  function handleFulfillFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setFulfillForm((current) => ({ ...current, [name]: value }));
  }

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

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeStoreId) {
      setErrorMessage("Select an active store before recording a sale.");
      return;
    }

    const typedProductName = createForm.productName.trim();
    const typedProductPrice = Number(createForm.productPrice);
    const productToUse = resolvedCreateMenuItem;

    if (!productToUse && !typedProductName) {
      setErrorMessage("Select an existing product or enter a new product name.");
      return;
    }

    if (!productToUse && (!createForm.productPrice || Number.isNaN(typedProductPrice) || typedProductPrice <= 0)) {
      setErrorMessage("Enter a selling price to create this product.");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        channel: createForm.channel,
        orderedAt: new Date(createForm.orderedAt).toISOString(),
        notes: createForm.notes.trim() || undefined,
        items: [
          productToUse
            ? {
                menuItemId: productToUse.id,
                quantity: Number(createForm.quantity),
              }
            : {
                newProductName: typedProductName,
                newProductPrice: typedProductPrice,
                quantity: Number(createForm.quantity),
              },
        ],
      };

      const response = await api.post<OrderRecord>(
        `/stores/${activeStoreId}/orders`,
        payload,
      );

      await loadOrdersView();

      setCreateForm((current) => ({
        ...current,
        menuItemId: "",
        productName: "",
        productPrice: "",
        quantity: "1",
        orderedAt: formatDateTimeLocalInput(),
        notes: "",
      }));

      setFulfillForm({
        orderId: response.data.id,
        fulfilledAt: formatDateTimeLocalInput(),
        notes: "",
      });

      setPaymentForm((current) => ({
        ...current,
        orderId: response.data.id,
        amountPaid: response.data.outstandingBalance,
      }));

      setSuccessMessage(
        `Order ${response.data.orderNumber} created for ${productToUse?.name ?? typedProductName}.`,
      );
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleFulfillOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fulfillForm.orderId) {
      setErrorMessage("Choose an order to fulfill.");
      return;
    }

    setIsFulfilling(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        fulfilledAt: new Date(fulfillForm.fulfilledAt).toISOString(),
        notes: fulfillForm.notes.trim() || undefined,
      };

      const response = await api.post<OrderRecord>(
        `/orders/${fulfillForm.orderId}/fulfill`,
        payload,
      );

      const refreshed = await loadOrdersView();

      const nextOpenOrder = refreshed.orders.find(
        (order) =>
          order.id !== fulfillForm.orderId && !order.fulfillmentState.isFulfilled,
      );

      setFulfillForm({
        orderId: nextOpenOrder?.id ?? "",
        fulfilledAt: formatDateTimeLocalInput(),
        notes: "",
      });

      setPaymentForm((current) => ({
        ...current,
        orderId: response.data.id,
        amountPaid: response.data.outstandingBalance,
      }));

      setSuccessMessage(`Order ${response.data.orderNumber} fulfilled.`);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsFulfilling(false);
    }
  }

  async function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paymentForm.orderId) {
      setErrorMessage("Choose an order to record payment for.");
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

      const refreshed = await loadOrdersView();

      const nextPayableOrder = refreshed.orders.find(
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
        `Payment recorded for ${response.data.salesOrder.orderNumber}: ${formatCurrency(response.data.amountPaid)}.`,
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
          eyebrow="Sales Ops"
          title="What was sold, what has been fulfilled, and what is still due?"
          description="Capture sales, fulfill from finished goods, and keep the order list current. Collections are also surfaced in Finance Ops for explicit billing visibility."
        />
        <StoreStateCard
          title="Resolving active store"
          description="Chunk is loading the active store before requesting sales data."
        />
      </section>
    );
  }

  if (!activeStoreId) {
    return (
      <section className="space-y-6">
        <PageHeader
          eyebrow="Sales Ops"
          title="What was sold, what has been fulfilled, and what is still due?"
          description="Capture sales, fulfill from finished goods, and keep the order list current. Collections are also surfaced in Finance Ops for explicit billing visibility."
        />
        <StoreStateCard
          title={storeErrorMessage ? "Unable to load stores" : "No active store found"}
          description={
            storeErrorMessage ??
            "Create or activate a store first. Sales Ops requests stay paused until a real store is selected."
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Sales Ops"
        title="What was sold, what has been fulfilled, and what is still due?"
        description={`Capture sales, fulfill from finished goods, and keep the order list current${activeStore ? ` for ${activeStore.name}` : ""}. Collections are also surfaced in Finance Ops for explicit billing visibility.`}
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

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Recent orders</h3>
            <Button
              onClick={() => void loadOrdersView()}
              variant="secondary"
              size="sm"
            >
              Refresh
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-600">Loading orders...</p>
            ) : null}

            {!isLoading && orders.length === 0 ? (
              <div className="ui-row text-sm text-slate-600">
                No orders yet.
              </div>
            ) : null}

            {orders.map((order) => (
              <div key={order.id} className="ui-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatStatus(order.channel)} | {formatDateTime(order.orderedAt)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <StatusChip tone={getOrderStatusTone(order.orderStatus)}>
                      {formatStatus(order.orderStatus)}
                    </StatusChip>
                    <StatusChip tone={getPaymentStatusTone(order.paymentStatus)}>
                      {formatStatus(order.paymentStatus)}
                    </StatusChip>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Total
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {formatCurrency(order.total)}
                    </p>
                  </div>

                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Paid
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {formatCurrency(order.paidAmount)}
                    </p>
                  </div>

                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Outstanding
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {formatCurrency(order.outstandingBalance)}
                    </p>
                  </div>

                  <div className="ui-stat">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Fulfilled
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {order.fulfillmentState.fulfilledAt
                        ? formatDateTime(order.fulfillmentState.fulfilledAt)
                        : "Not yet"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-line/70">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-2 text-sm text-slate-700"
                    >
                      <span>{item.menuItem.name}</span>
                      <span>
                        {formatNumber(item.quantity)} x {formatCurrency(item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                {order.notes ? (
                  <p className="mt-3 text-sm text-slate-600">{order.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Create order</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Record a sale against an existing product, or type a new one and let Chunk create it automatically.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleCreateOrder}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Select or enter product
                </span>
                <p className="mb-2 text-xs text-slate-500">
                  Pick an existing product or type a new one to create it automatically.
                </p>
                <select
                  name="menuItemId"
                  value={createForm.menuItemId}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                >
                  <option value="">
                    {menuItems.length === 0
                      ? "No existing products available"
                      : "Select an existing product"}
                  </option>
                  {menuItems.map((menuItem) => (
                    <option key={menuItem.id} value={menuItem.id}>
                      {menuItem.name} | {formatCurrency(menuItem.defaultPrice)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  New product name
                </span>
                <input
                  type="text"
                  name="productName"
                  value={createForm.productName}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                  placeholder="e.g. Tomato Soup Bowl"
                />
              </label>

              {menuItems.length === 0 ? (
                <div className="ui-subtle-panel text-sm text-slate-700">
                  No products yet. Enter a product name and record your first sale.
                </div>
              ) : null}

              {resolvedCreateMenuItem ? (
                <div className="ui-subtle-panel text-sm text-slate-700">
                  <p>Product: {resolvedCreateMenuItem.name}</p>
                  <p className="mt-1">
                    Unit price: {formatCurrency(resolvedCreateMenuItem.defaultPrice)}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Existing product selected. Sale will use the current product record.
                  </p>
                </div>
              ) : null}

              {!resolvedCreateMenuItem && createForm.productName.trim() ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Selling price
                  </span>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    name="productPrice"
                    value={createForm.productPrice}
                    onChange={handleCreateFieldChange}
                    className="ui-input"
                    placeholder="0.00"
                    required={!resolvedCreateMenuItem}
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Quantity
                </span>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  name="quantity"
                  value={createForm.quantity}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Channel
                </span>
                <select
                  name="channel"
                  value={createForm.channel}
                  onChange={handleCreateFieldChange}
                  className="ui-input"
                  required
                >
                  {SALES_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {formatStatus(channel)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Ordered at
                </span>
                <input
                  type="datetime-local"
                  name="orderedAt"
                  value={createForm.orderedAt}
                  onChange={handleCreateFieldChange}
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
                  value={createForm.notes}
                  onChange={handleCreateFieldChange}
                  className="ui-textarea"
                  placeholder="Optional order note"
                />
              </label>

              <Button
                type="submit"
                disabled={
                  isCreating ||
                  (!resolvedCreateMenuItem &&
                    !createForm.productName.trim())
                }
                fullWidth
              >
                {isCreating ? "Creating order..." : "Create order"}
              </Button>
            </form>
          </div>

          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Fulfill order</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Post sale movements against finished goods for an unfulfilled order.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleFulfillOrder}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Open order
                </span>
                <select
                  name="orderId"
                  value={fulfillForm.orderId}
                  onChange={handleFulfillFieldChange}
                  className="ui-input"
                  required
                >
                  <option value="" disabled>
                    {openOrders.length === 0 ? "No open orders" : "Select an order"}
                  </option>
                  {openOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} | {formatCurrency(order.total)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedFulfillOrder ? (
                <div className="ui-subtle-panel text-sm text-slate-700">
                  <p>Total: {formatCurrency(selectedFulfillOrder.total)}</p>
                  <p className="mt-1">
                    Items: {selectedFulfillOrder.items.map((item) => item.menuItem.name).join(", ")}
                  </p>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Fulfilled at
                </span>
                <input
                  type="datetime-local"
                  name="fulfilledAt"
                  value={fulfillForm.fulfilledAt}
                  onChange={handleFulfillFieldChange}
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
                  value={fulfillForm.notes}
                  onChange={handleFulfillFieldChange}
                  className="ui-textarea"
                  placeholder="Optional fulfillment note"
                />
              </label>

              <Button
                type="submit"
                disabled={isFulfilling || openOrders.length === 0}
                fullWidth
              >
                {isFulfilling ? "Fulfilling order..." : "Fulfill order"}
              </Button>
            </form>
          </div>

          <div className="rounded-3xl border border-line bg-panel p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink">Record payment</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Record a receipt against any order with an outstanding balance.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleRecordPayment}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Payable order
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
                      ? "No payable orders"
                      : "Select an order"}
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
                  <p>Total: {formatCurrency(selectedPaymentOrder.total)}</p>
                  <p className="mt-1">
                    Outstanding: {formatCurrency(selectedPaymentOrder.outstandingBalance)}
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
                  Amount paid
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
                {isRecordingPayment ? "Recording payment..." : "Record payment"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
