"use client";

import { useIsTargetHidden } from "@/hooks/use-target-hidden";
import { Button } from "@/components/ui/Button";
import { formatSum } from "@/lib/money";
import { cn } from "@/lib/cn";

export interface HotelMobileCtaBarProps {
  price: number;
  perNightText?: string;
  buttonText?: string;
  targetId?: string;
  roomsTargetId?: string;
  className?: string;
}

export function HotelMobileCtaBar({
  price,
  perNightText,
  buttonText,
  targetId = "hotel-original-cta",
  roomsTargetId = "rooms",
  className,
}: HotelMobileCtaBarProps) {
  const isHidden = useIsTargetHidden(targetId);

  const handleAction = () => {
    const el = document.getElementById(roomsTargetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.hash = roomsTargetId;
    }
  };

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
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">
              {formatSum(price)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
              / {perNightText}
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          rounded="xl"
          onClick={handleAction}
          className="shrink-0"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
