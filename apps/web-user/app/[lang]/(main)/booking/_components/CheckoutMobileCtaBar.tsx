"use client";

import { useIsTargetHidden } from "@/hooks/use-target-hidden";
import { Button } from "@/components/ui/Button";
import { formatSum } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { CheckoutDict } from "@/i18n/dictionaries";

export interface CheckoutMobileCtaBarProps {
  total: number;
  totalLabel?: string;
  buttonText?: string;
  dict?: Pick<CheckoutDict, "total" | "payButton"> | { total?: string; payButton?: string };
  pending?: boolean;
  disabled?: boolean;
  targetId?: string;
  className?: string;
}

export function CheckoutMobileCtaBar({
  total,
  totalLabel = "Jami",
  buttonText = "To'lash",
  dict,
  pending = false,
  disabled = false,
  targetId = "checkout-original-cta",
  className,
}: CheckoutMobileCtaBarProps) {
  const isHidden = useIsTargetHidden(targetId);
  const resolvedTotalLabel = dict?.total ?? totalLabel;
  const resolvedButtonText = dict?.payButton ?? buttonText;

  return (
    <div
      aria-hidden={!isHidden}
      className={cn(
        "fixed bottom-16 inset-x-0 z-40 md:hidden bg-white border-t border-slate-200 px-4 py-3 dark:bg-slate-900 dark:border-slate-800 transition-all duration-300 ease-in-out",
        isHidden
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {resolvedTotalLabel}
          </span>
          <span className="text-lg font-black text-slate-900 dark:text-white truncate">
            {formatSum(total)}
          </span>
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          rounded="xl"
          loading={pending}
          disabled={disabled}
          className="shrink-0 font-extrabold"
        >
          {resolvedButtonText}
        </Button>
      </div>
    </div>
  );
}
