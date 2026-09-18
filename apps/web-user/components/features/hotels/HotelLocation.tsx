import { MapPin, ExternalLink } from "lucide-react";

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
}: {
  address: string;
  latitude: number;
  longitude: number;
}) {
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : `https://www.google.com/maps?q=${encodeURIComponent(address)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900">{address}</span>
          {!hasCoordinates && (
            <span className="text-xs text-slate-400">
              Aniq joylashuv koordinatalari mavjud emas
            </span>
          )}
        </div>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
      >
        <ExternalLink className="h-4 w-4 text-slate-400" />
        Google Maps'da ochish
      </a>
    </div>
  );
}
