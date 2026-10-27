/**
 * Hamkor turi (partnerType) bo'yicha UI terminologiyasi.
 *
 * Barcha sahifalarda terminologiyani ulashish uchun markaziy joy.
 * Yangi hamkor turi qo'shilganda shu fayldagina qo'shish kifoya.
 */

export interface PartnerLabels {
  /** Bosh sahifa nomi */
  dashboardTitle: string;
  /** Bosh sahifa ko'zcha matni */
  dashboardEyebrow: string;
  /** Xona / joy birligi, birlik */
  unitSingular: string;
  /** Xona / joy birligi, ko'plik */
  unitPlural: string;
  /** Xona / joy qo'shish tugmasi matni */
  addUnitLabel: string;
  /** Bron / chipta / band qilish */
  reservationLabel: string;
  /** Rezervatsiyalar sahifasi nomi */
  reservationsTitle: string;
  /** Topbar subtitle */
  topbarSubtitle: string;
  /** Kalendar sahifasi sarlavhasi */
  calendarTitle: string;
  /** Kalendar sahifasi tavsifi */
  calendarDescription: string;
  /** Xonalar sahifasi sarlavhasi */
  unitsPageTitle: string;
  /** Xonalar sahifasi tavsifi */
  unitsPageDescription: string;
  /** Listing (e'lon) sahifasi nomi */
  listingTitle: string;
  /** Check-in termini */
  checkInLabel: string;
  /** Check-out termini */
  checkOutLabel: string;
  /** Check-in amali (tugma va bildirishnomalar uchun) */
  checkInActionLabel: string;
  /** Check-out amali (tugma va bildirishnomalar uchun) */
  checkOutActionLabel: string;
  /** Obyekt ish/ochilish vaqti (qoidalar va e'lon uchun) */
  openingTimeLabel: string;
  /** Obyekt ish/yopilish vaqti (qoidalar va e'lon uchun) */
  closingTimeLabel: string;
  /** Mijoz yoki yo'lovchi */
  guestLabel: string;
  /** Front desk sarlavhasi */
  frontDeskTitle: string;
  /** Front desk tavsifi */
  frontDeskDescription: string;
  /** Xona haritasi yoki boshqa */
  unitsMapTitle: string;
  /** xonalar/joylar mavjudligini ko'rsatadigan */
  availabilityLabel: string;
  /** Tashkilot turi belgisi (mehmonxona yulduzlar uchun) */
  entityTypeLabel: string;
  /** Xona turi yoki tovar turi */
  unitTypeLabel: string;
  /** Xona turlari sarlavhasi */
  unitTypesTitle: string;
  /** Yangi bron qo'shish */
  newBookingLabel: string;
  /** Walk-in dialog sarlavhasi */
  walkInTitle: string;
  /** Xonalar xaritasida guruhlash birligi (qavat/zal), birlik shaklda */
  floorSingular: string;
  /** Qavatlar / zallar ko'plik shaklda (qavatlar/zallar/sektorlar) */
  floorPlural: string;
  /** Tashkilotga jo'nalish kelishigida (Mehmonxonaga, Restoranga, Hostelga, Avtoparkka, Dachaga) */
  facilityDirectional: string;
  /** Xona / joy turi ko'plik shaklda (xona turlari, stol toifalari, avtomobil toifalari) */
  unitTypePlural: string;
  /** Narx birligi / muddati (/ kecha, / kun, depozit) */
  pricingUnit: string;
  /** Yakka birlik qo'shish rejimi (Yakka xona, Yakka stol, Yakka avtomobil) */
  singleUnitModeLabel: string;
  /** Ommaviy birlik qo'shish rejimi (Guruhlab qo'shish) */
  bulkUnitModeLabel: string;
  /** Holat terminologiyalari */
  statusCleanLabel: string;
  statusDirtyLabel: string;
  statusOccupiedLabel: string;
  statusOutOfServiceLabel: string;
  /** Identifikator (Raqam/Davlat raqami) yorlig'i */
  unitIdentifierLabel: string;
  /** Identifikator placeholder */
  unitIdentifierPlaceholder: string;
  /** Birlik holati yorlig'i */
  unitStatusLabel: string;
  /** Narx yorlig'i (1 kechaga / 1 kunga) */
  priceLabel: string;
  /** Sig'im qo'shimchasi (kishi, o'rindiq) */
  capacitySuffix: string;
  /** Maxsus turlar bayroqlari */
  isHostel: boolean;
  isRestaurant: boolean;
  isBus: boolean;
  isDacha: boolean;
}

const HOTEL_LABELS: PartnerLabels = {
  dashboardTitle: "Front Desk",
  dashboardEyebrow: "Bugungi navbat",
  unitSingular: "xona",
  unitPlural: "xonalar",
  addUnitLabel: "Yangi xona qo'shish",
  reservationLabel: "Bron",
  reservationsTitle: "Bronlar",
  topbarSubtitle: "Mehmonxona boshqaruv paneli",
  calendarTitle: "Xona Bandlik Kalendari",
  calendarDescription: "Har bir xona bo'yicha bandlik, to'lov va kelish-ketish sanalarini kuzating.",
  unitsPageTitle: "Xonalar Xaritasi",
  unitsPageDescription: "Mehmonxonadagi barcha xonalarning qavatma-qavat joylashuvi.",
  listingTitle: "Mehmonxona E'loni",
  checkInLabel: "Kirish (Check-in)",
  checkOutLabel: "Chiqish (Check-out)",
  checkInActionLabel: "Check-in",
  checkOutActionLabel: "Check-out",
  openingTimeLabel: "Kirish vaqti",
  closingTimeLabel: "Chiqish vaqti",
  guestLabel: "Mehmon",
  frontDeskTitle: "Front Desk",
  frontDeskDescription: "Bugungi vazifalar va navbat.",
  unitsMapTitle: "Xona Xaritasi",
  availabilityLabel: "E'londagi xonalar",
  entityTypeLabel: "Yulduzlar",
  unitTypeLabel: "Xona turi",
  unitTypesTitle: "Xona Turlari",
  newBookingLabel: "Yangi bron",
  walkInTitle: "Walk-in bron",
  floorSingular: "qavat",
  floorPlural: "qavatlar",
  facilityDirectional: "Mehmonxonaga",
  unitTypePlural: "xona turlari",
  pricingUnit: "/ kecha",
  singleUnitModeLabel: "Yakka xona",
  bulkUnitModeLabel: "Guruhlab qo'shish (Ommaviy)",
  statusCleanLabel: "Toza (Vacant Clean)",
  statusDirtyLabel: "Nopok (Tozalash kerak)",
  statusOccupiedLabel: "Band (Mehmon bor)",
  statusOutOfServiceLabel: "Ta'mirda (Out of Service)",
  unitIdentifierLabel: "Xona raqami",
  unitIdentifierPlaceholder: "101",
  unitStatusLabel: "Xona holati",
  priceLabel: "1 kechaga:",
  capacitySuffix: "kishi",
  isHostel: false,
  isRestaurant: false,
  isBus: false,
  isDacha: false,
};

const DACHA_LABELS: PartnerLabels = {
  dashboardTitle: "Dacha Boshqaruvi",
  dashboardEyebrow: "Bugungi holat",
  unitSingular: "dacha",
  unitPlural: "dachalar",
  addUnitLabel: "Dacha qo'shish",
  reservationLabel: "Band qilish",
  reservationsTitle: "Band qilishlar",
  topbarSubtitle: "Dacha boshqaruv paneli",
  calendarTitle: "Dacha Bandlik Kalendari",
  calendarDescription: "Dachaingizning band va bo'sh kunlarini kuzating.",
  unitsPageTitle: "Dacha Ma'lumotlari",
  unitsPageDescription: "Dacha xususiyatlari va parametrlarini boshqaring.",
  listingTitle: "Dacha E'loni",
  checkInLabel: "Kelish sanasi",
  checkOutLabel: "Ketish sanasi",
  checkInActionLabel: "Qabul qilish",
  checkOutActionLabel: "Kuzatish",
  openingTimeLabel: "Kirish vaqti",
  closingTimeLabel: "Chiqish vaqti",
  guestLabel: "Mehmon",
  frontDeskTitle: "Dacha Boshqaruvi",
  frontDeskDescription: "Bugungi band qilishlar va vazifalar.",
  unitsMapTitle: "Dacha Bandlik",
  availabilityLabel: "Dacha holati",
  entityTypeLabel: "Xususiyatlar",
  unitTypeLabel: "Xona",
  unitTypesTitle: "Xona Turlari",
  newBookingLabel: "Yangi band qilish",
  walkInTitle: "Bevosita band qilish",
  floorSingular: "qavat",
  floorPlural: "qavatlar",
  facilityDirectional: "Dachaga",
  unitTypePlural: "xona turlari",
  pricingUnit: "/ kecha",
  singleUnitModeLabel: "Yakka dacha",
  bulkUnitModeLabel: "Guruhlab qo'shish",
  statusCleanLabel: "Bo'sh & Tayyor",
  statusDirtyLabel: "Tozalanmoqda",
  statusOccupiedLabel: "Band",
  statusOutOfServiceLabel: "Ta'mirda",
  unitIdentifierLabel: "Dacha raqami",
  unitIdentifierPlaceholder: "1",
  unitStatusLabel: "Dacha holati",
  priceLabel: "1 kechaga:",
  capacitySuffix: "kishi",
  isHostel: false,
  isRestaurant: false,
  isBus: false,
  isDacha: true,
};

const HOSTEL_LABELS: PartnerLabels = {
  dashboardTitle: "Front Desk",
  dashboardEyebrow: "Bugungi navbat",
  unitSingular: "yotoq (joy)",
  unitPlural: "yotoqlar (joylar)",
  addUnitLabel: "Yangi yotoq qo'shish",
  reservationLabel: "Band qilish",
  reservationsTitle: "Band qilishlar",
  topbarSubtitle: "Hostel boshqaruv paneli",
  calendarTitle: "Yotoq Bandlik Kalendari",
  calendarDescription: "Har bir yotoq/joy bo'yicha bandlik va kelish-ketishlarni kuzating.",
  unitsPageTitle: "Yotoqlar Xaritasi",
  unitsPageDescription: "Hosteldagi barcha yotoq va joylarning joylashuvi.",
  listingTitle: "Hostel E'loni",
  checkInLabel: "Kirish",
  checkOutLabel: "Chiqish",
  checkInActionLabel: "Check-in",
  checkOutActionLabel: "Check-out",
  openingTimeLabel: "Kirish vaqti",
  closingTimeLabel: "Chiqish vaqti",
  guestLabel: "Mehmon",
  frontDeskTitle: "Front Desk",
  frontDeskDescription: "Bugungi band qilishlar va vazifalar.",
  unitsMapTitle: "Yotoqlar Xaritasi",
  availabilityLabel: "E'londagi joylar",
  entityTypeLabel: "Xususiyatlar",
  unitTypeLabel: "Xona / Dormitory turi",
  unitTypesTitle: "Xona / Dormitory Turlari",
  newBookingLabel: "Yangi band qilish",
  walkInTitle: "Bevosita band qilish",
  floorSingular: "qavat",
  floorPlural: "qavatlar",
  facilityDirectional: "Hostelga",
  unitTypePlural: "xona / joy turlari",
  pricingUnit: "/ kecha",
  singleUnitModeLabel: "Yakka xona / joy",
  bulkUnitModeLabel: "Guruhlab qo'shish (Ommaviy)",
  statusCleanLabel: "Bo'sh & Tayyor",
  statusDirtyLabel: "Tozalanmoqda",
  statusOccupiedLabel: "Band (Mehmon bor)",
  statusOutOfServiceLabel: "Ta'mirda",
  unitIdentifierLabel: "Xona / Joy raqami",
  unitIdentifierPlaceholder: "202",
  unitStatusLabel: "Joy holati",
  priceLabel: "1 kechaga:",
  capacitySuffix: "kishi",
  isHostel: true,
  isRestaurant: false,
  isBus: false,
  isDacha: false,
};

const BUS_LABELS: PartnerLabels = {
  dashboardTitle: "Bugungi Ijaralar",
  dashboardEyebrow: "Bugungi olib ketish va qaytarishlar",
  unitSingular: "avtomobil",
  unitPlural: "avtomobillar",
  addUnitLabel: "Yangi avtomobil qo'shish",
  reservationLabel: "Ijara",
  reservationsTitle: "Ijaralar",
  topbarSubtitle: "Rent Car boshqaruv paneli",
  calendarTitle: "Avtomobil Bandligi",
  calendarDescription: "Har bir avtomobilning ijara sanalari va bandlik holatini kuzating.",
  unitsPageTitle: "Avtomobil Parki",
  unitsPageDescription: "Kompaniyangizdagi barcha ijaraga beriladigan avtomobillar ro'yxati.",
  listingTitle: "Rent Car E'loni",
  checkInLabel: "Olib ketish vaqti",
  checkOutLabel: "Qaytarib keldi",
  checkInActionLabel: "Topshirish (Olib ketdi)",
  checkOutActionLabel: "Qabul qilish (Qaytdi)",
  openingTimeLabel: "Olib ketish vaqti",
  closingTimeLabel: "Qaytarish vaqti",
  guestLabel: "Mijoz",
  frontDeskTitle: "Ijara Boshqaruvi",
  frontDeskDescription: "Bugungi ijaraga beriladigan va qaytadigan avtomobillar.",
  unitsMapTitle: "Avtomobil Parki",
  availabilityLabel: "Bo'sh avtomobillar",
  entityTypeLabel: "Avtomobil klassi",
  unitTypeLabel: "Klass / Toifa",
  unitTypesTitle: "Avtomobil Klasslari",
  newBookingLabel: "Yangi ijara",
  walkInTitle: "Joyida ijara",
  floorSingular: "sektor",
  floorPlural: "sektorlar",
  facilityDirectional: "Avtoparkka",
  unitTypePlural: "avtomobil toifalari",
  pricingUnit: "/ kun",
  singleUnitModeLabel: "Yakka avtomobil",
  bulkUnitModeLabel: "Guruhlab qo'shish",
  statusCleanLabel: "Bo'sh & Tayyor",
  statusDirtyLabel: "Moyka / Tozalanmoqda",
  statusOccupiedLabel: "Ijarada (Mijozda)",
  statusOutOfServiceLabel: "Servis / Ta'mirda",
  unitIdentifierLabel: "Transport / Davlat raqami",
  unitIdentifierPlaceholder: "01 A 777 AA",
  unitStatusLabel: "Transport holati",
  priceLabel: "1 kunga (ijara):",
  capacitySuffix: "o'rindiq",
  isHostel: false,
  isRestaurant: false,
  isBus: true,
  isDacha: false,
};

const RESTAURANT_LABELS: PartnerLabels = {
  dashboardTitle: "Bugungi Bronlar",
  dashboardEyebrow: "Bugungi navbat",
  unitSingular: "stol",
  unitPlural: "stollar",
  addUnitLabel: "Yangi stol qo'shish",
  reservationLabel: "Bron",
  reservationsTitle: "Bronlar",
  topbarSubtitle: "Restoran boshqaruv paneli",
  calendarTitle: "Kunlik Jadval",
  calendarDescription: "Bugungi stollar va vaqt-slotlar bo'yicha bandlikni kuzating.",
  unitsPageTitle: "Stollar Xaritasi",
  unitsPageDescription: "Restorandagi barcha stollarning joylashuvi va sig'imi.",
  listingTitle: "Restoran E'loni",
  checkInLabel: "Tashrif vaqti",
  checkOutLabel: "Yakunlash vaqti",
  checkInActionLabel: "Mijoz keldi (Qabul)",
  checkOutActionLabel: "Stol bo'shadi",
  openingTimeLabel: "Ochilish vaqti",
  closingTimeLabel: "Yopilish vaqti",
  guestLabel: "Mehmon",
  frontDeskTitle: "Bugungi Bronlar",
  frontDeskDescription: "Bugungi rezervatsiyalar va navbat.",
  unitsMapTitle: "Stollar Xaritasi",
  availabilityLabel: "Bo'sh stollar",
  entityTypeLabel: "Taom turi",
  unitTypeLabel: "Stol toifasi",
  unitTypesTitle: "Stol Toifalari",
  newBookingLabel: "Yangi bron",
  walkInTitle: "Bevosita bron",
  floorSingular: "zal",
  floorPlural: "zallar",
  facilityDirectional: "Restoranga",
  unitTypePlural: "stol toifalari",
  pricingUnit: "so'm (depozit)",
  singleUnitModeLabel: "Yakka stol",
  bulkUnitModeLabel: "Guruhlab qo'shish (Ommaviy)",
  statusCleanLabel: "Bo'sh & Tayyor",
  statusDirtyLabel: "Tozalanmoqda / Yig'ishtirilmoqda",
  statusOccupiedLabel: "Band (Mijoz o'tiribdi)",
  statusOutOfServiceLabel: "Zaxirada / Yopiq",
  unitIdentifierLabel: "Stol raqami",
  unitIdentifierPlaceholder: "Stol-12, VIP-1",
  unitStatusLabel: "Stol holati",
  priceLabel: "Minimal depozit:",
  capacitySuffix: "kishi",
  isHostel: false,
  isRestaurant: true,
  isBus: false,
  isDacha: false,
};

const GUESTHOUSE_LABELS: PartnerLabels = {
  ...HOTEL_LABELS,
  topbarSubtitle: "Mehmon uyi boshqaruv paneli",
  dashboardTitle: "Mehmon Uyi Boshqaruvi",
  listingTitle: "Mehmon Uyi E'loni",
  facilityDirectional: "Mehmon uyiga",
  calendarDescription: "Har bir xona bo'yicha bandlik va kelish-ketishlarni kuzating.",
};

const MOTEL_LABELS: PartnerLabels = {
  ...HOTEL_LABELS,
  topbarSubtitle: "Motel boshqaruv paneli",
  listingTitle: "Motel E'loni",
  facilityDirectional: "Motelga",
};

const LABELS_MAP: Record<string, PartnerLabels> = {
  hotel: HOTEL_LABELS,
  dacha: DACHA_LABELS,
  hostel: HOSTEL_LABELS,
  bus: BUS_LABELS,
  rent_car: BUS_LABELS,
  guesthouse: GUESTHOUSE_LABELS,
  motel: MOTEL_LABELS,
  restaurant: RESTAURANT_LABELS,
  mixed: HOTEL_LABELS,
};

/**
 * Hamkor turini qaytaradi; agar topilmasa, hotel standartini qaytaradi.
 */
export function getPartnerLabels(partnerType?: string | null): PartnerLabels {
  const type = (partnerType ?? "hotel").toLowerCase();
  return LABELS_MAP[type] ?? HOTEL_LABELS;
}

/**
 * Sidebar va boshqa komponentlar uchun partnerType'ning hamkor turi tekshiruvi.
 */
export function hasRooms(partnerType?: string | null): boolean {
  const type = (partnerType ?? "hotel").toLowerCase();
  // Dacha — xona boshqaruvi shart emas, butun boshli obyekt bir yurt.
  return type !== "dacha";
}

export function hasBuses(partnerType?: string | null): boolean {
  const type = (partnerType ?? "hotel").toLowerCase();
  return type === "bus" || type === "rent_car";
}

export function isDacha(partnerType?: string | null): boolean {
  return (partnerType ?? "hotel").toLowerCase() === "dacha";
}

/** Hostel — dormitory xonalar ichida alohida yotoqlar bo'yicha band qilinadi. */
export function hasBeds(partnerType?: string | null): boolean {
  return (partnerType ?? "hotel").toLowerCase() === "hostel";
}

/** Yulduzli tasniflash faqat mehmonxona-uslubidagi obyektlarga tegishli. */
export function hasStarRating(partnerType?: string | null): boolean {
  const type = (partnerType ?? "hotel").toLowerCase();
  return type === "hotel" || type === "motel" || type === "guesthouse" || type === "mixed";
}

/** Restoran — bron kecha-oralig'i emas, kun ichidagi vaqt-slot asosida. */
export function isRestaurant(partnerType?: string | null): boolean {
  return (partnerType ?? "hotel").toLowerCase() === "restaurant";
}

/** Vaqt-slot asosida band qilinadigan hamkor turlari (hozircha faqat restoran). */
export function hasTimeSlots(partnerType?: string | null): boolean {
  return isRestaurant(partnerType);
}

/**
 * Toifa / xona turi nomini hamkor sohasi (mehmonxona, restoran, dacha, transport va h.k.)
 * kontekstiga mos ravishda to'g'irlab formatlaydi.
 *
 * Masalan, bazada eski/umumiy "Standart xona" yoki "Deluxe xona" bo'lsa:
 * - Restoran: "Standart stol (Umumiy zal)" / "VIP Stol (Alohida kabinet)" yoki "xona" -> "stol"
 * - Transport: "Standart avtomobil"
 * - Dacha: "Asosiy bino" / "Dacha hududi"
 */
export function formatUnitTypeName(
  name?: string | null,
  partnerTypeOrLabels?: string | Partial<PartnerLabels> | null,
): string {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  const isRest =
    typeof partnerTypeOrLabels === "object" && partnerTypeOrLabels !== null
      ? Boolean(partnerTypeOrLabels.isRestaurant)
      : isRestaurant(partnerTypeOrLabels as string);

  const isB =
    typeof partnerTypeOrLabels === "object" && partnerTypeOrLabels !== null
      ? Boolean(partnerTypeOrLabels.isBus)
      : hasBuses(partnerTypeOrLabels as string);

  const isHost =
    typeof partnerTypeOrLabels === "object" && partnerTypeOrLabels !== null
      ? Boolean(partnerTypeOrLabels.isHostel)
      : hasBeds(partnerTypeOrLabels as string);

  const isDach =
    typeof partnerTypeOrLabels === "object" && partnerTypeOrLabels !== null
      ? Boolean(partnerTypeOrLabels.isDacha)
      : isDacha(partnerTypeOrLabels as string);

  if (isRest) {
    const lower = trimmed.toLowerCase();
    if (lower === "standart xona" || lower === "standard room" || lower === "стандартный номер" || lower === "standart") {
      return "Standart stol (Umumiy zal)";
    }
    if (lower === "deluxe xona" || lower === "deluxe room" || lower === "делюкс номер" || lower === "deluxe") {
      return "VIP Stol (Alohida kabinet)";
    }
    if (lower === "suite" || lower === "suite xona" || lower === "люкс") {
      return "Banket stoli / Katta zal";
    }
    let formatted = trimmed
      .replace(/\bxonalar\b/gi, "stollar")
      .replace(/\bxonasi\b/gi, "stoli")
      .replace(/\bxonani\b/gi, "stolni")
      .replace(/\bxonaga\b/gi, "stolga")
      .replace(/\bxonada\b/gi, "stolda")
      .replace(/\bxona\b/gi, "stol")
      .replace(/\bXonalar\b/g, "Stollar")
      .replace(/\bXonasi\b/g, "Stoli")
      .replace(/\bXonani\b/g, "Stolni")
      .replace(/\bXonaga\b/g, "Stolga")
      .replace(/\bXonada\b/g, "Stolda")
      .replace(/\bXona\b/g, "Stol")
      .replace(/\broom\b/gi, "table")
      .replace(/\bRoom\b/g, "Table")
      .replace(/\bномер\b/gi, "стол")
      .replace(/\bНомер\b/g, "Стол");

    if (formatted.toLowerCase().includes("xona")) {
      formatted = formatted.replace(/xona/gi, "stol").replace(/Xona/g, "Stol");
    }
    return formatted;
  }

  if (isB) {
    const lower = trimmed.toLowerCase();
    if (lower.includes("xona") || lower.includes("room") || lower.includes("номер")) {
      return trimmed
        .replace(/\bxonalar\b/gi, "avtomobillar")
        .replace(/\bxona\b/gi, "avtomobil")
        .replace(/\bXonalar\b/g, "Avtomobillar")
        .replace(/\bXona\b/g, "Avtomobil")
        .replace(/\broom\b/gi, "vehicle")
        .replace(/\bRoom\b/g, "Vehicle");
    }
  }

  if (isHost) {
    const lower = trimmed.toLowerCase();
    if (lower === "standart xona" || lower === "standard room" || lower === "стандартный номер") {
      return "Umumiy yotoqxona (Dormitory)";
    }
    if (lower === "deluxe xona" || lower === "deluxe room" || lower === "делюкс номер") {
      return "Alohida qulay xona";
    }
    return trimmed
      .replace(/\bxonalar\b/gi, "yotoqxonalar")
      .replace(/\bxona\b/gi, "yotoqxona")
      .replace(/\bXonalar\b/g, "Yotoqxonalar")
      .replace(/\bXona\b/g, "Yotoqxona");
  }

  if (isDach) {
    const lower = trimmed.toLowerCase();
    if (lower === "standart xona" || lower === "standard room" || lower === "стандартный номер") {
      return "Dacha (Kottej)";
    }
    if (lower === "deluxe xona" || lower === "deluxe room" || lower === "делюкс номер") {
      return "Butun dacha (Asosiy kottej)";
    }
    return trimmed
      .replace(/\bxonalar\b/gi, "kottejlar")
      .replace(/\bxona\b/gi, "kottej")
      .replace(/\bXonalar\b/g, "Kottejlar")
      .replace(/\bXona\b/g, "Kottej");
  }

  return trimmed;
}
