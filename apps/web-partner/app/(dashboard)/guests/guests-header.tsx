"use client";

import { Download, Plus } from "lucide-react";
import { Button } from "../../_components/ui/button";
import { PageHeader } from "../../_components/layout/page-header";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";

interface GuestsHeaderProps {
  labels: PartnerLabels;
  guestPlural: string;
  totalGuests: number;
  onExportCsv: () => void;
  onNewBooking: () => void;
  isExporting?: boolean;
}

export function GuestsHeader({
  labels,
  guestPlural,
  totalGuests,
  onExportCsv,
  onNewBooking,
  isExporting = false,
}: GuestsHeaderProps) {
  return (
    <PageHeader
      eyebrow={labels.guestLabel}
      title={guestPlural}
      description={`${labels.guestLabel} profili, ijaralar va xaridlar tarixi (${totalGuests} nafar mijoz bazada).`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={isExporting || totalGuests === 0}
            className="gap-1.5"
            title="Mehmonlar ro'yxatini Excel/CSV formatida yuklab olish"
          >
            <Download className="h-4 w-4" aria-hidden />
            <span>CSV Eksport</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onNewBooking}
            className="gap-1.5"
            title="Yangi bron yaratish"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Yangi bron</span>
          </Button>
        </div>
      }
    />
  );
}
