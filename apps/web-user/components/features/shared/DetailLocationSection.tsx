import { MapPin, ExternalLink } from "lucide-react";
import { InteractiveMapView, MapMarkerItem } from "@/components/features/map/InteractiveMapView";

export function DetailLocationSection({
  title = "Joylashuv",
  address,
  latitude,
  longitude,
  itemName,
  itemImage,
  itemRating,
  itemPrice,
  openInMapsText = "Google Maps'da ochish",
  noCoordsText = "Xarita koordinatalari mavjud emas",
}: {
  title?: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  itemName?: string;
  itemImage?: string;
  itemRating?: number;
  itemPrice?: string;
  openInMapsText?: string;
  noCoordsText?: string;
}) {
  const numLat = Number(latitude);
  const numLng = Number(longitude);
  const hasCoordinates = latitude != null && longitude != null && !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0;
  
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${numLat},${numLng}`
    : `https://www.google.com/maps?q=${encodeURIComponent(address)}`;

  const mapItems: MapMarkerItem[] = hasCoordinates ? [
    {
      id: "1",
      lat: numLat,
      lng: numLng,
      name: itemName || address,
      address: address,
      imageUrl: itemImage,
      rating: itemRating,
      priceFormatted: itemPrice,
    }
  ] : [];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex flex-col gap-4 w-full md:w-[320px] shrink-0">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">{address}</span>
            </div>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.98]"
          >
            <ExternalLink className="h-4 w-4" />
            {openInMapsText}
          </a>
        </div>
        
        <div className="w-full h-[400px]">
          {hasCoordinates ? (
            <InteractiveMapView 
              items={mapItems} 
              className="relative h-[400px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm dark:border-slate-800"
              zoom={14}
            />
          ) : (
            <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {noCoordsText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
