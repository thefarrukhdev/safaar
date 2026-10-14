import type { Bed, ReservationView } from "../../_lib/domain/types";

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

  const rows = items.map((r) => {
    const bed = r.bedId ? beds.find((b) => b.id === r.bedId) : undefined;
    return [
      r.id,
      r.guest.fullName,
      `+${r.guest.phone}`,
      r.roomTypeName,
      [r.roomNumber, bed?.label].filter(Boolean).join(" · "),
      r.checkIn,
      ...(restaurant ? [r.slotTime ?? ""] : [r.checkOut, r.nights]),
      r.totalPrice,
      r.paidAmount,
      r.status,
      r.source,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
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
