import type { ReactNode } from "react";

type StatusChipTone = "primary" | "success" | "warning" | "danger" | "neutral";

type StatusChipProps = {
  children: ReactNode;
  tone?: StatusChipTone;
  className?: string;
};

const toneClassMap: Record<StatusChipTone, string> = {
  primary: "border-blue-100 bg-accentSoft text-accent",
  success: "border-emerald-100 bg-emerald-50 text-success",
  warning: "border-amber-100 bg-amber-50 text-warning",
  danger: "border-red-100 bg-red-50 text-danger",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StatusChip({
  children,
  tone = "neutral",
  className = "",
}: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClassMap[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
