import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type SectionContainerProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionContainer({
  title,
  description,
  action,
  children,
  className = "",
}: SectionContainerProps) {
  return (
    <Card className={`p-6 lg:p-7 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink lg:text-xl">
            {title}
          </h3>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </Card>
  );
}
