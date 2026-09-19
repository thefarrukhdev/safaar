import { MapPin, ExternalLink } from "lucide-react";
import type { HotelDetailDict } from "@/i18n/dictionaries";

/**
 * Avvalgi versiya butunlay statik edi (props qabul qilmasdan): Toshkentning
 * bir nuqtasiga markazlashtirilgan, haqiqiy API kalitisiz "signature=mock"
 * bilan Google Static Maps'ga so'rov yuborardi (hech qachon ishlamaydi) va
 * to'rtta obyekt-yaqinidagi joygacha masofani (aeroport/markaz/vokzal/savdo
 * markazi) HAR BIR mehmonxona uchun bir xil raqamlar bilan ko'rsatardi.
 *
 * Loyihada haqiqiy xarita provayderi (Google Maps API kaliti va h.k.) yoki
 * POI-masofa manbasi yo'q — shuning uchun bu yerda soxta xarita/masofa
 * ko'rsatilmaydi. Mavjud haqiqiy ma'lumot — mehmonxonaning o'z
 * latitude/longitude/address'i — orqali foydalanuvchini haqiqiy xarita
 * ilovasiga (Google Maps) yo'naltiramiz.
 */
export function HotelLocation({
  address,
  latitude,
  longitude,
  dict,
}: {
  address: string;
  latitude: number;
  longitude: number;
  dict?: HotelDetailDict["location"];
}) {
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : `https://www.google.com/maps?q=${encodeURIComponent(address)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-slate-900/[0.08] bg-white p-4">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900">{address}</span>
          {!hasCoordinates && (
            <span className="text-xs text-slate-400">
              {dict?.noCoordinates ?? "Aniq joylashuv koordinatalari mavjud emas"}
            </span>
          )}
        </div>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 max-md:h-11 w-fit items-center justify-center gap-2 rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] px-5 text-sm font-medium text-slate-900  transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <ExternalLink className="h-4 w-4 text-slate-900/70" />
        {dict?.openInMaps ?? "Google Maps'da ochish"}
      </a>
    </div>
  );
}
