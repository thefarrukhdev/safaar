"use client";

import { useIsTargetHidden } from "@/hooks/use-target-hidden";
import { formatSum } from "@/lib/money";
import { cn } from "@/lib/cn";

export interface HotelMobileCtaBarProps {
  price: number;
  perNightText?: string;
  buttonText?: string;
  targetId?: string;
  roomsTargetId?: string;
  className?: string;
  locale?: string;
}

export function HotelMobileCtaBar({
  price,
  perNightText,
  buttonText,
  targetId = "hotel-original-cta",
  roomsTargetId = "rooms",
  className,
  locale,
}: HotelMobileCtaBarProps) {
  const isOriginalCtaHidden = useIsTargetHidden(targetId);
  const isRoomsHidden = useIsTargetHidden(roomsTargetId, "0px", 0);
  const showSticky = isOriginalCtaHidden && isRoomsHidden;

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
      aria-hidden={!showSticky}
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 w-full md:hidden bg-white border-t border-slate-200 px-4 pt-3 pb-safe transition-[transform,opacity] duration-200 ease-out",
        showSticky
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums text-slate-900 truncate">
              {formatSum(price, locale)}
            </span>
            <span className="text-xs text-slate-500 shrink-0">
              / {perNightText}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAction}
          className="shrink-0 inline-flex h-12 items-center justify-center gap-2 px-6 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-full active:scale-[0.97] transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:pointer-events-none disabled:bg-slate-100 disabled:text-slate-400 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
