import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type BadgeVariant = "sale" | "new" | "low-moq" | "hot" | "default";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  sale: "bg-sale text-white",
  new: "bg-fg text-bg",
  "low-moq": "bg-surface text-fg border border-border",
  hot: "bg-accent text-white",
  default: "bg-surface text-text-muted",
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
        "inline-flex items-center justify-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        variantStyles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}