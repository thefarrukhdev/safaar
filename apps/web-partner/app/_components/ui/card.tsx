import type { HTMLAttributes } from "react";
import { cn } from "../../_lib/utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hover'da yengil ko'tarilish (qo'lda klikli kartalar uchun). */
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border-light)] bg-[var(--surface)] transition-all duration-200",
        "relative overflow-hidden",
        interactive &&
        "hover:border-[var(--border)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold md:text-base", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[var(--muted-foreground)]", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}
