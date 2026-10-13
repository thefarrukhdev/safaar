import { Suspense } from "react";
import { ReservationsView } from "./reservations-view";
import { LoadingState } from "../../_components/ui/empty-state";

export default function ReservationsPage() {
  return (
    <Suspense fallback={<LoadingState title="Bronlar yuklanmoqda..." />}>
      <ReservationsView />
    </Suspense>
  );
}
