import type { GuestProfile } from "../../_lib/domain/types";
import { formatDate } from "../../_lib/utils/format";
import type { GuestCalculatedStats } from "./types";

/**
 * Mehmonlar ro'yxatini Excel/Numbers uchun to'liq mos keladigan UTF-8 BOM bilan
 * CSV formatida yuklab beruvchi yordamchi funksiya.
 */
export function exportGuestsToCsv(
  items: GuestProfile[],
  guestStats: Map<string, GuestCalculatedStats>,
  isBus: boolean,
) {
  const stayColTitle = isBus ? "Ijaralar soni" : "Tashriflar soni";
  const lastStayColTitle = isBus ? "Oxirgi ijara sanasi" : "Oxirgi tashrif sanasi";

  const headers = [
    "ID",
    "Mijoz (F.I.SH)",
    "Telefon",
    "Email",
    "Mijoz darajasi",
    stayColTitle,
    "Jami sarflangan summa (UZS)",
    "Rad etilgan bronlar",
    lastStayColTitle,
    "Teglar",
  ];

  const rows = items.map((g) => {
    const stats = guestStats.get(g.id) ?? {
      totalStays: 0,
      totalSpent: 0,
      lastStay: undefined,
      rejectedStays: 0,
    };

    const phoneRaw = g.phone ? g.phone.trim() : "";
    const phoneFormatted = phoneRaw
      ? phoneRaw.startsWith("+")
        ? phoneRaw
        : `+${phoneRaw}`
      : "";

    return [
      g.id,
      g.fullName,
      phoneFormatted,
      g.email ?? "",
      g.isVip ? "VIP mijoz" : "Standart",
      stats.totalStays,
      stats.totalSpent,
      stats.rejectedStays,
      stats.lastStay ? formatDate(stats.lastStay) : "",
      g.tags.join("; "),
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
  a.download = `mehmonlar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
