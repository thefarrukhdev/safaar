import { isSlotWithinOperatingHours } from './operating-hours';

describe('isSlotWithinOperatingHours', () => {
  describe("bir kunlik oraliq (09:00 -> 23:00) — eski xulq-atvor o'zgarmasligi", () => {
    const open = '09:00';
    const close = '23:00';

    it.each([
      ['09:00', true], // ochilish vaqtining o'zi — INKLYUZIV
      ['09:01', true],
      ['12:00', true],
      ['22:59', true], // yopilishdan bir daqiqa oldin
    ])('%s -> yaroqli', (slot, expected) => {
      expect(isSlotWithinOperatingHours(slot, open, close)).toBe(expected);
    });

    it.each([
      ['23:00', false], // yopilish vaqtining o'zi — EKSKLYUZIV
      ['23:01', false], // yopilishdan bir daqiqa keyin
      ['08:59', false], // ochilishdan bir daqiqa oldin
      ['06:00', false],
      ['00:30', false],
    ])('%s -> yaroqsiz', (slot, expected) => {
      expect(isSlotWithinOperatingHours(slot, open, close)).toBe(expected);
    });
  });

  describe('yarim tundan o\'tuvchi oraliq (07:01 -> 01:53) — "Osh markazi" regressiyasi', () => {
    const open = '07:01';
    const close = '01:53';

    it.each([
      ['07:01', true], // ochilish vaqtining o'zi — INKLYUZIV
      ['07:02', true],
      ['10:00', true],
      ['23:00', true],
      ['23:59', true],
      ['00:00', true], // yarim tundan o'tish
      ['00:30', true],
      ['01:52', true], // yopilishdan bir daqiqa oldin
    ])('%s -> yaroqli', (slot, expected) => {
      expect(isSlotWithinOperatingHours(slot, open, close)).toBe(expected);
    });

    it.each([
      ['01:53', false], // yopilish vaqtining o'zi — EKSKLYUZIV
      ['01:54', false], // yopilishdan bir daqiqa keyin
      ['02:00', false],
      ['06:00', false],
      ['07:00', false], // ochilishdan bir daqiqa oldin
    ])('%s -> yaroqsiz', (slot, expected) => {
      expect(isSlotWithinOperatingHours(slot, open, close)).toBe(expected);
    });
  });

  describe("ish vaqti to'liq sozlanmagan holatlar (eski xulq-atvor)", () => {
    it("ikkalasi ham NULL — cheklov yo'q", () => {
      expect(isSlotWithinOperatingHours('03:00', null, null)).toBe(true);
    });

    it('faqat ochilish vaqti sozlangan — pastki chegara INKLYUZIV', () => {
      expect(isSlotWithinOperatingHours('09:00', '09:00', null)).toBe(true);
      expect(isSlotWithinOperatingHours('08:59', '09:00', null)).toBe(false);
    });

    it('faqat yopilish vaqti sozlangan — yuqori chegara EKSKLYUZIV', () => {
      expect(isSlotWithinOperatingHours('22:59', null, '23:00')).toBe(true);
      expect(isSlotWithinOperatingHours('23:00', null, '23:00')).toBe(false);
    });

    it("bo'sh satr NULL kabi ishlaydi (eski truthiness tekshiruvi)", () => {
      expect(isSlotWithinOperatingHours('03:00', '', '')).toBe(true);
    });
  });

  describe('close === open — semantikasi belgilanmagan, eski xulq-atvor saqlanadi', () => {
    // DIQQAT: bu holat uchun mahsulot qarori YO'Q ("24 soat ochiq"mi yoki
    // "yopiq"mi hech qayerda belgilanmagan). Eski kod har qanday vaqtni
    // rad etardi — ortga moslik uchun aynan shu saqlangan. Bu testning
    // maqsadi — xulq-atvor ATAYLAB saqlanganini qayd etish, uni
    // "to'g'ri" deb tasdiqlash emas.
    it('har qanday vaqtni rad etadi (hujjatlashtirilgan, tasdiqlanmagan xulq-atvor)', () => {
      expect(isSlotWithinOperatingHours('12:00', '10:00', '10:00')).toBe(false);
      expect(isSlotWithinOperatingHours('10:00', '10:00', '10:00')).toBe(false);
      expect(isSlotWithinOperatingHours('00:00', '00:00', '00:00')).toBe(false);
    });
  });
});
