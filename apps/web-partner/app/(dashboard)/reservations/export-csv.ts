import { ReservationSource, type Bed, type ReservationView } from "../../_lib/domain/types";

/**
 * Bronlar ro'yxatini Excel/Numbers uchun to'liq mos keladigan UTF-8 BOM bilan
 * CSV formatida yuklab beruvchi yordamchi funksiya.
 */
export function exportReservationsToCsv(
  items: ReservationView[],
  unitLabel: string,
  beds: Bed[],
  restaurant: boolean,
) {
  const headers = [
    "ID",
    "Mijoz",
    "Telefon",
    `${unitLabel} turi`,
    unitLabel,
    "Sana",
    ...(restaurant ? ["Vaqt"] : ["Ketish", "Kech."]),
    "Summa",
    "To'langan",
    "Status",
    "Manba",
  ];

  const statusLabels: Record<string, string> = {
    PENDING: "Yangi (Kutilmoqda)",
    AWAITING_PAYMENT: "To'lov kutilmoqda",
    AWAITING_PARTNER_CONFIRMATION: "Tasdiqlash kutilmoqda",
    CONFIRMED: "Tasdiqlangan",
    IN_HOUSE: "Yashayapti",
    COMPLETED: "Yakunlangan",
    CANCELLED: "Bekor qilingan",
    EXPIRED: "Muddati o'tgan",
  };

  const sourceLabels: Record<string, string> = {
    [ReservationSource.UZBRON]: "Safaar",
    [ReservationSource.WALK_IN]: "Walk-in",
    [ReservationSource.PHONE]: "Telefon",
    [ReservationSource.BOOKING_COM]: "Booking.com",
  };

  const rows = items.map((r) => {
    const bed = r.bedId ? beds.find((b) => b.id === r.bedId) : undefined;
    const phoneRaw = r.guest.phone ? r.guest.phone.trim() : "";
    const phoneFormatted = phoneRaw
      ? phoneRaw.startsWith("+")
        ? phoneRaw
        : `+${phoneRaw}`
      : "";

    return [
      r.id,
      r.guest.fullName,
      phoneFormatted,
      r.roomTypeName,
      [r.roomNumber, bed?.label].filter(Boolean).join(" · ") || "Belgilanmagan",
      r.checkIn,
      ...(restaurant ? [r.slotTime ?? ""] : [r.checkOut, r.nights]),
      r.totalPrice,
      r.paidAmount,
      statusLabels[r.status] || r.status,
      (r.source && sourceLabels[r.source]) || r.source || "",
    ];
  });

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          let s = String(cell ?? "");
          if (/^[=+\-@\t\r]/.test(s)) {
            s = `'${s}`;
          }
          if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bronlar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
