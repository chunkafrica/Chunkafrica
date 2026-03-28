import { Card } from "@/components/ui/card";

type MetricBoxProps = {
  label: string;
  value: string;
  detail: string;
  className?: string;
};

export function MetricBox({
  label,
  value,
  detail,
  className = "",
}: MetricBoxProps) {
  return (
    <Card className={`p-5 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-[1.85rem] font-bold tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </Card>
  );
}
