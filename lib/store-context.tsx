"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";

const ACTIVE_STORE_STORAGE_KEY = "chunk.activeStoreId";

export type StoreSummary = {
  id: string;
  name: string;
  code: string | null;
  storeType: string;
  isActive: boolean;
  isPrimary: boolean;
};

type ActiveStoreContextValue = {
  stores: StoreSummary[];
  activeStoreId: string | null;
  activeStore: StoreSummary | null;
  isResolvingStore: boolean;
  storeErrorMessage: string | null;
  setActiveStoreId: (storeId: string) => void;
  refreshStores: () => Promise<void>;
};

const ActiveStoreContext = createContext<ActiveStoreContextValue | null>(null);

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

  return "Unable to load stores.";
}

function resolveActiveStoreId(stores: StoreSummary[]) {
  if (stores.length === 0) {
    return null;
  }

  if (typeof window !== "undefined") {
    const savedStoreId = window.localStorage.getItem(ACTIVE_STORE_STORAGE_KEY);
    if (savedStoreId && stores.some((store) => store.id === savedStoreId)) {
      return savedStoreId;
    }
  }

  const primaryStore = stores.find((store) => store.isPrimary);
  if (primaryStore) {
    return primaryStore.id;
  }

  if (stores.length === 1) {
    return stores[0].id;
  }

  return stores[0].id;
}

export function ActiveStoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(null);
  const [isResolvingStore, setIsResolvingStore] = useState(true);
  const [storeErrorMessage, setStoreErrorMessage] = useState<string | null>(null);

  async function refreshStores() {
    setIsResolvingStore(true);
    setStoreErrorMessage(null);

    try {
      const response = await api.get<StoreSummary[]>("/stores");
      const nextStores = response.data;
      const nextActiveStoreId = resolveActiveStoreId(nextStores);

      setStores(nextStores);
      setActiveStoreIdState(nextActiveStoreId);

      if (typeof window !== "undefined") {
        if (nextActiveStoreId) {
          window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, nextActiveStoreId);
        } else {
          window.localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
        }
      }
    } catch (error) {
      setStores([]);
      setActiveStoreIdState(null);
      setStoreErrorMessage(extractErrorMessage(error));
    } finally {
      setIsResolvingStore(false);
    }
  }

  useEffect(() => {
    void refreshStores();
  }, []);

  function setActiveStoreId(storeId: string) {
    if (!stores.some((store) => store.id === storeId)) {
      return;
    }

    setActiveStoreIdState(storeId);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, storeId);
    }
  }

  const activeStore =
    stores.find((store) => store.id === activeStoreId) ?? null;

  return (
    <ActiveStoreContext.Provider
      value={{
        stores,
        activeStoreId,
        activeStore,
        isResolvingStore,
        storeErrorMessage,
        setActiveStoreId,
        refreshStores,
      }}
    >
      {children}
    </ActiveStoreContext.Provider>
  );
}

export function useActiveStore() {
  const context = useContext(ActiveStoreContext);

  if (!context) {
    throw new Error("useActiveStore must be used within ActiveStoreProvider.");
  }

  return context;
}
