import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-sm hover:bg-blue-700 focus-visible:outline-accent",
  secondary:
    "border border-line bg-surface text-ink shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-accent",
  danger:
    "bg-danger text-white shadow-sm hover:bg-red-600 focus-visible:outline-danger",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-4 text-sm",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-semibold tracking-[-0.01em] transition duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${sizeClassMap[size]} ${variantClassMap[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
