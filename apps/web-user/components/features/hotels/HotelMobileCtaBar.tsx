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
        "fixed bottom-16 inset-x-0 z-40 md:hidden bg-white border-t border-slate-900/[0.08] shadow-float px-4 py-3 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
        isHidden
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums text-slate-900 truncate">
              {formatSum(price)}
            </span>
            <span className="text-xs text-slate-900/70 shrink-0">
              / {perNightText}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAction}
          className="shrink-0 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-blue-700/50 bg-blue-600 px-6 text-base font-medium text-white shadow-emboss-primary transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] active:shadow-emboss-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
