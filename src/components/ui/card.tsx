import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Premium card primitive (shadcn pattern). The physical material lives in the
// `.card` / `.card-interactive` CSS layer (globals.css); this file only wires
// structure + variants so every surface across the app reads as one system.
const cardVariants = cva("card", {
  variants: {
    variant: {
      default: "",
      interactive: "card-interactive",
    },
  },
  defaultVariants: { variant: "interactive" },
});

export interface CardProps
  extends ComponentProps<"div">,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-base font-bold leading-snug tracking-[-0.01em] text-fg", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-text-secondary", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-4 p-5 pt-0 text-xs text-text-muted", className)}
      {...props}
    />
  );
}
