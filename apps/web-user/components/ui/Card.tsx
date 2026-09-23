import * as React from "react";
import { cn } from "@/lib/cn";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-slate-900/[0.08] bg-white text-slate-900 shadow-sm dark:border-white/[0.10] dark:bg-slate-900 dark:text-white",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

// Backward compatibility alias
export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-7", className)} {...props} />;
}
