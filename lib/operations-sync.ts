export type InventoryAdjustment = {
  inventoryItemId?: string;
  inventoryItemName?: string;
  quantityChange: number;
};

export type ProductionCompletionSyncEvent = {
  kind: "production-batch-completed";
  batchId: string;
  occurredAt: string;
  adjustments: InventoryAdjustment[];
};

const OPERATIONS_SYNC_EVENT_NAME = "chunk:operations-sync";
const OPERATIONS_SYNC_STORAGE_KEY = "chunk:operations-sync";

export function emitOperationsSync(event: ProductionCompletionSyncEvent) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProductionCompletionSyncEvent>(OPERATIONS_SYNC_EVENT_NAME, {
      detail: event,
    }),
  );

  try {
    window.localStorage.setItem(
      OPERATIONS_SYNC_STORAGE_KEY,
      JSON.stringify({
        ...event,
        emittedAt: Date.now(),
      }),
    );
  } catch {
    // Best-effort sync for other tabs only.
  }
}

export function subscribeToOperationsSync(
  handler: (event: ProductionCompletionSyncEvent) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    handler((event as CustomEvent<ProductionCompletionSyncEvent>).detail);
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (
      event.key !== OPERATIONS_SYNC_STORAGE_KEY ||
      !event.newValue
    ) {
      return;
    }

    try {
      const payload = JSON.parse(event.newValue) as ProductionCompletionSyncEvent;
      handler(payload);
    } catch {
      // Ignore malformed sync payloads.
    }
  };

  window.addEventListener(
    OPERATIONS_SYNC_EVENT_NAME,
    handleCustomEvent as EventListener,
  );
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(
      OPERATIONS_SYNC_EVENT_NAME,
      handleCustomEvent as EventListener,
    );
    window.removeEventListener("storage", handleStorageEvent);
  };
}
