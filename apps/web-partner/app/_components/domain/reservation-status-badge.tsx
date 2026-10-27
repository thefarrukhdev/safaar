import {
  AlertCircle,
  CarFront,
  CheckCircle2,
  Clock,
  House,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { BookingStatus } from "@safaar/types";
import { Badge } from "../ui/badge";
import type { ReservationUiStatus } from "../../_lib/domain/types";
import { useAuthStore } from "../../_stores/auth-store";

const config: Record<
  ReservationUiStatus,
  {
    label: string;
    tone: "warning" | "brand" | "accent" | "danger" | "neutral";
    icon: typeof Clock;
  }
> = {
  [BookingStatus.PENDING]: {
    label: "Javob kutilmoqda",
    tone: "warning",
    icon: Clock,
  },
  [BookingStatus.AWAITING_PAYMENT]: {
    label: "To'lov kutilmoqda",
    tone: "warning",
    icon: Clock,
  },
  [BookingStatus.AWAITING_PARTNER_CONFIRMATION]: {
    label: "Tasdiq kutilmoqda",
    tone: "warning",
    icon: Clock,
  },
  [BookingStatus.CONFIRMED]: {
    label: "Tasdiqlangan",
    tone: "brand",
    icon: CheckCircle2,
  },
  IN_HOUSE: {
    label: "Hozir yashayapti",
    tone: "accent",
    icon: House,
  },
  [BookingStatus.CANCELLED]: {
    label: "Bekor qilingan",
    tone: "danger",
    icon: XCircle,
  },
  [BookingStatus.COMPLETED]: {
    label: "Yakunlangan",
    tone: "neutral",
    icon: CheckCircle2,
  },
  [BookingStatus.EXPIRED]: {
    label: "Muddati o'tgan",
    tone: "danger",
    icon: AlertCircle,
  },
};

export function ReservationStatusBadge({
  status,
  partnerType: propPartnerType,
}: {
  status: ReservationUiStatus;
  partnerType?: string | null;
}) {
  const storePartnerType = useAuthStore((s) => s.user?.partnerType);
  const partnerType = (propPartnerType ?? storePartnerType ?? "").toLowerCase();
  const isRestaurant = partnerType === "restaurant";
  const isBus = partnerType === "bus" || partnerType === "rent_car";
  const isDacha = partnerType === "dacha";

  const c = config[status];
  let label = c.label;
  let Icon = c.icon;

  if (status === "IN_HOUSE") {
    if (isRestaurant) {
      label = "Mijoz kelgan (Amalda)";
      Icon = UtensilsCrossed;
    } else if (isBus) {
      label = "Ijarada (Mijozda)";
      Icon = CarFront;
    } else if (isDacha) {
      label = "Dachada (Band)";
      Icon = House;
    }
  }

  return (
    <Badge tone={c.tone} icon={<Icon className="h-3 w-3" aria-hidden />}>
      {label}
    </Badge>
  );
}
