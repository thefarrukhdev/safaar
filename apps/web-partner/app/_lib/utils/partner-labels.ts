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
  checkInLabel: "Ochilish vaqti",
  checkOutLabel: "Yopilish vaqti",
  guestLabel: "Mehmon",
  frontDeskTitle: "Bugungi Bronlar",
  frontDeskDescription: "Bugungi rezervatsiyalar va navbat.",
  unitsMapTitle: "Stollar Xaritasi",
  availabilityLabel: "Bo'sh stollar",
  entityTypeLabel: "Taom turi",
  unitTypeLabel: "Stol sig'imi (necha kishilik)",
  unitTypesTitle: "Stol Sig'imlari",
  newBookingLabel: "Yangi bron",
  walkInTitle: "Bevosita bron",
  floorSingular: "zal",
  unitIdentifierLabel: "Stol raqami",
  unitIdentifierPlaceholder: "Masalan: 12",
  unitStatusLabel: "Stol holati",
  priceLabel: "Narxi:",
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
  calendarDescription: "Har bir xona bo'yicha bandlik va kelish-ketishlarni kuzating.",
};

const MOTEL_LABELS: PartnerLabels = {
  ...HOTEL_LABELS,
  topbarSubtitle: "Motel boshqaruv paneli",
  listingTitle: "Motel E'loni",
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
