import type { ReservationView } from "../../_lib/domain/types";
import { formatDate } from "../../_lib/utils/format";

/**
 * To'liq hisobot ma'lumotlarini UTF-8 BOM bilan CSV formatida yuklab olish
 */
export function exportReportToCsv(reservations: ReservationView[], filenamePrefix = "hisobot") {
  const headers = [
    "Bron ID",
    "Mijoz (F.I.SH)",
    "Telefon",
    "Kelish sanasi",
    "Ketish sanasi",
    "Xona / Birlik",
    "Kechalar",
    "Jami summa (UZS)",
    "To'langan summa (UZS)",
    "To'lov turi",
    "Manba",
    "Holat",
  ];

  const rows = reservations.map((r) => {
    const isOnline = r.source === "UZBRON";
    const phoneRaw = r.guest?.phone ? r.guest.phone.trim() : "";
    const phoneFormatted = phoneRaw
      ? phoneRaw.startsWith("+")
        ? phoneRaw
        : `+${phoneRaw}`
      : "";

    return [
      r.id,
      r.guest?.fullName ?? "—",
      phoneFormatted,
      formatDate(r.checkIn),
      formatDate(r.checkOut),
      `${r.roomTypeName}${r.roomNumber ? ` (${r.roomNumber})` : ""}`,
      r.nights,
      r.totalPrice,
      r.paidAmount,
      isOnline ? "Online (UzBron)" : "Joyida (Naqd/Karta)",
      r.source,
      r.status,
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
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
