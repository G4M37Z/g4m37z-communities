"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const base =
  "press inline-flex items-center justify-center gap-2 rounded-md font-semibold " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-bg " +
  "disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover " +
    "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
  secondary:
    "bg-surface-elevated text-fg border border-border " +
    "hover:bg-surface-subtle hover:border-border-strong",
  outline:
    "bg-transparent text-fg border border-border " +
    "hover:bg-surface hover:border-border-strong",
  ghost: "bg-transparent text-fg hover:bg-surface",
  destructive:
    "bg-sale text-white hover:bg-sale/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";