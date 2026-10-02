"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { CompassLoader } from "@/components/ui/FastLoader";
import type { MapContainerProps } from "./MapContainer";

export type { MapMarkerItem } from "./MapContainer";

const DynamicMap = dynamic<MapContainerProps>(
 () => import("./MapContainer").then((mod) => mod.MapContainer),
 {
 ssr: false,
 loading: () => (
 <div className="flex h-[550px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white/80">
 <CompassLoader />
 <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
 <MapPin className="h-4 w-4 text-blue-500" />
 Xarita yuklanmoqda...
 </p>
 </div>
 ),
 }
);

export function InteractiveMapView(props: MapContainerProps) {
 return <DynamicMap {...props} />;
}
