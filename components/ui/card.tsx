import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`overflow-hidden rounded-[24px] border border-line bg-panel shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
