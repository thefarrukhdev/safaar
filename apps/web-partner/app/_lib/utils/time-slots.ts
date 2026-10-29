/** Restoran uchun kun ichidagi vaqt-slotlarni hisoblash yordamchilari. */

export const SLOT_STEP_MINUTES = 30;
/** Har bir restoran broni standart bo'yicha nechta daqiqa davom etadi (stol band hisoblanadi). */
export const DEFAULT_SLOT_DURATION_MINUTES = 90;

export function toMinutes(hhmm?: string | null): number {
  if (!hhmm || typeof hhmm !== "string") return 0;
  const parts = hhmm.trim().split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.min(23, Math.max(0, h)) * 60 + Math.min(59, Math.max(0, m));
}

export function toHHMM(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60)
    .toString()
    .padStart(2, "0");
  const m = (norm % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function buildDefaultSlots(): string[] {
  const slots: string[] = [];
  for (let t = 9 * 60; t < 24 * 60; t += SLOT_STEP_MINUTES) {
    slots.push(toHHMM(t));
  }
  return slots;
}

function buildAllDaySlots(): string[] {
  const slots: string[] = [];
  for (let t = 0; t < 24 * 60; t += SLOT_STEP_MINUTES) {
    slots.push(toHHMM(t));
  }
  return slots;
}

/** Ochilish/yopilish vaqtidan `SLOT_STEP_MINUTES` qadamli slotlar ro'yxatini yaratadi. */
export function buildTimeSlots(openTime?: string | null, closeTime?: string | null): string[] {
  if (!openTime || !closeTime || typeof openTime !== "string" || typeof closeTime !== "string") {
    return buildDefaultSlots();
  }

  const start = toMinutes(openTime);
  const end = toMinutes(closeTime);

  // Agar vaqtlar bir xil bo'lsa (24 soat)
  if (start === end) {
    return buildAllDaySlots();
  }

  const slots: string[] = [];

  if (end > start) {
    // Standart kunduzgi ish vaqti (masalan 09:00 dan 23:00 gacha)
    for (let t = start; t < end; t += SLOT_STEP_MINUTES) {
      slots.push(toHHMM(t));
    }
  } else {
    // Tungi ish vaqti (masalan 22:25 dan 10:25 gacha)
    // 1. start dan 24:00 (1440) gacha
    for (let t = start; t < 1440; t += SLOT_STEP_MINUTES) {
      slots.push(toHHMM(t));
    }
    // 2. 00:00 dan end gacha
    for (let t = 0; t < end; t += SLOT_STEP_MINUTES) {
      slots.push(toHHMM(t));
    }
  }

  return slots.length > 0 ? slots : buildDefaultSlots();
}

