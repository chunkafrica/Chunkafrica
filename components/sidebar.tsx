"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveStore } from "@/lib/store-context";

const coreNavItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Today's operating pulse",
    badge: "DB",
  },
  {
    href: "/production-ops",
    label: "Production Ops",
    description: "Batches, yield, and variance",
    badge: "PO",
  },
  {
    href: "/sales-ops",
    label: "Sales Ops",
    description: "Orders, channels, fulfillment",
    badge: "SO",
  },
  {
    href: "/inventory-ops",
    label: "Inventory Ops",
    description: "Stock position and replenishment",
    badge: "IO",
  },
  {
    href: "/finance-ops",
    label: "Finance Ops",
    description: "Invoices, receipts, balances",
    badge: "FO",
  },
  {
    href: "/insights",
    label: "Insights",
    description: "Revenue, leakage, performance",
    badge: "IN",
  },
];

const optionalNavItems = [
  {
    href: "/customer-ops",
    label: "Customer Ops",
    description: "Buyer visibility and follow-up",
    badge: "CO",
  },
  {
    href: "/business-ops",
    label: "Business Ops",
    description: "Controls, suppliers, workflows",
    badge: "BO",
  },
  {
    href: "/system",
    label: "System",
    description: "Roles, settings, configuration",
    badge: "SY",
  },
];

const supportingNavItems = [
  {
    href: "/waste",
    label: "Waste Log",
    description: "Keep the current loss workflow live",
    badge: "WL",
  },
];

type NavItem = {
  href: string;
  label: string;
  description: string;
  badge: string;
};

export function Sidebar() {
  const pathname = usePathname();
  const {
    stores,
    activeStoreId,
    activeStore,
    isResolvingStore,
    storeErrorMessage,
    setActiveStoreId,
  } = useActiveStore();

  function renderNavLink(item: NavItem) {
    const isActive =
      pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group flex items-start gap-3 rounded-[20px] px-3.5 py-3.5 transition ${
          isActive
            ? "bg-accentSoft text-accent shadow-sm"
            : "text-slate-600 hover:bg-slate-50 hover:text-ink"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
            isActive
              ? "border-blue-100 bg-white text-accent"
              : "border-line bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-ink"
          }`}
        >
          {item.badge}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[-0.01em]">{item.label}</p>
          <p
            className={`mt-1 text-xs leading-5 ${
              isActive ? "text-blue-700/80" : "text-slate-500"
            }`}
          >
            {item.description}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <aside className="border-b border-line/80 bg-[var(--sidebar-bg)] px-4 py-4 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[18rem] lg:flex-col lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="rounded-[24px] border border-white/70 bg-panel/95 p-4 shadow-card lg:flex lg:h-full lg:flex-col lg:p-5">
        <div className="mb-5 flex items-start justify-between gap-4 lg:block">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
              Chunk v2
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink">
              Operations OS
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">
              Control what happens between input, output, and revenue.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-background px-3 py-2 text-right text-xs text-slate-600">
            <p className="font-semibold text-ink">Snackit</p>
            <p className="mt-1 uppercase tracking-wide text-slate-500">
              Phase 1 shell
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-line bg-background px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Active Store
          </p>

          {isResolvingStore ? (
            <p className="mt-3 text-sm text-slate-600">Resolving store context...</p>
          ) : null}

          {!isResolvingStore && storeErrorMessage ? (
            <p className="mt-3 text-sm text-red-600">{storeErrorMessage}</p>
          ) : null}

          {!isResolvingStore && !storeErrorMessage && activeStore ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-ink">{activeStore.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                  {activeStore.storeType.replaceAll("_", " ")}
                  {activeStore.code ? ` | ${activeStore.code}` : ""}
                </p>
              </div>

              {stores.length > 1 ? (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Switch store
                  </span>
                  <select
                    value={activeStoreId ?? ""}
                    onChange={(event) => setActiveStoreId(event.target.value)}
                    className="ui-input h-10 text-sm"
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {!isResolvingStore && !storeErrorMessage && !activeStore ? (
            <p className="mt-3 text-sm text-slate-600">
              No active stores found yet.
            </p>
          ) : null}
        </div>

        <div className="grid gap-6 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Core Modules
            </p>
            <nav className="grid gap-1.5">{coreNavItems.map(renderNavLink)}</nav>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Optional Modules
            </p>
            <nav className="grid gap-1.5">{optionalNavItems.map(renderNavLink)}</nav>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Records
            </p>
            <nav className="grid gap-1.5">{supportingNavItems.map(renderNavLink)}</nav>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-background px-4 py-4 text-sm leading-6 text-slate-500">
          Build for kitchens now. Keep the structure ready for fashion production next.
        </div>
      </div>
    </aside>
  );
}
