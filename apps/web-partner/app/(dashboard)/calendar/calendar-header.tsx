"use client";

import { Lock, Plus, RefreshCw } from "lucide-react";
import { Button } from "../../_components/ui/button";
import { PageHeader } from "../../_components/layout/page-header";
import { Tooltip } from "../../_components/ui/tooltip";

interface CalendarHeaderProps {
  title: string;
  description: string;
  newBookingLabel: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onOpenWalkIn: () => void;
  onOpenBlackout: () => void;
}

export function CalendarHeader({
  title,
  description,
  newBookingLabel,
  isRefreshing = false,
  onRefresh,
  onOpenWalkIn,
  onOpenBlackout,
}: CalendarHeaderProps) {
  return (
    <PageHeader
      eyebrow="Operatsion"
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Tooltip content="Ma'lumotlarni qayta yangilash">
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Ma'lumotlarni yangilash"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin text-brand-600" : ""}`}
                  aria-hidden="true"
                />
              </Button>
            </Tooltip>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onOpenBlackout}
            className="hidden sm:inline-flex"
          >
            <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Inventarni yopish
          </Button>

          <Button
            size="sm"
            onClick={onOpenWalkIn}
            className="shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {newBookingLabel}
          </Button>
        </div>
      }
    />
  );
}
