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
        "fixed bottom-16 inset-x-0 z-40 md:hidden bg-white border-t border-slate-900/[0.08] border border-slate-200 px-4 py-3   transition-all duration-300 ease-in-out",
        isHidden
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-slate-500 ">
            {resolvedTotalLabel}
          </span>
          <span className="text-xl font-bold text-slate-900  truncate">
            {formatSum(total)}
          </span>
        </div>

        <Button
          type="submit"
          size="lg"
          
          loading={pending}
          disabled={disabled}
          className="shrink-0 font-bold px-6 py-6 text-base bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 rounded-xl active:scale-[0.98] transition-transform"
        >
          {resolvedButtonText}
        </Button>
      </div>
    </div>
  );
}
