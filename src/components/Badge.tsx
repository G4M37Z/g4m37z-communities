import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "destructive"
  | "subtle";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-elevated text-text-secondary border border-border",
  accent: "bg-accent-soft/40 text-accent border border-accent-soft/60",
  success: "bg-success-soft/30 text-success border border-success/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
  destructive: "bg-sale/15 text-sale border border-sale/30",
  subtle: "bg-surface text-text-muted border border-border",
};

export function Badge({
  variant = "default",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-sm px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        variantStyles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}