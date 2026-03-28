import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: PageHeaderProps) {
  return (
    <Card className={`p-7 lg:p-8 ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-ink lg:text-[2rem]">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
            {description}
          </p>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </Card>
  );
}
