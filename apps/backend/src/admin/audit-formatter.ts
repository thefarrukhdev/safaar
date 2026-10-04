export type DbRow = Record<string, unknown>;

/**
 * Frontend `apps/web-admin/lib/api/admin-api.ts`dagi `activityMessage` va
 * `toActivityLog` tomonidan maxsus case orqali qo'llab-quvvatlanadigan 15 ta action kaliti.
 * Ular uchun `action` ustunini o'zgartirmaymiz (chunki frontend ularning `metadata`sini
 * o'qiydi va ikonkalarni `partner`/`cancel` so'zlari orqali aniqlaydi).
 */
export const FRONTEND_HANDLED_AUDIT_ACTIONS = new Set<string>([
  'partner.moderation',
  'partner.status',
  'partner.commission',
  'partner.adjustment',
  'partner.delete',
  'settings.update',
  'booking.admin_cancel',
  'user.admin_delete',
  'user.admin_message',
  'user.bonus_adjustment',
  'partner_request',
  'booking_created',
  'booking_cancelled',
  'complaint',
  'user_registered',
]);

/**
 * Tizimdagi barcha audit harakatlari uchun inson tushunadigan o'zbekcha matnlar.
 */
export const AUDIT_ACTION_UZBEK_LABELS: Record<string, string> = {
  // Screenshot actions (Outbox & Worker events)
  outbox_event_dead: "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
  'outbox_event.dead': "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
  'outbox.dead': "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
  outbox_manual_retry_requested: "Xabarnomani qayta yuborish so'raldi",
  'outbox_event.retry': "Xabarnomani qayta yuborish so'raldi",
  outbox_event_processed: 'Xabarnoma muvaffaqiyatli yetkazildi',

  // Screenshot actions (User lifecycle & status)
  user_reactivated: 'Foydalanuvchi hisobi faollashtirildi',
  'user.reactivated': 'Foydalanuvchi hisobi faollashtirildi',
  'user.reactivate': 'Foydalanuvchi hisobi faollashtirildi',
  user_suspended: 'Foydalanuvchi hisobi bloklandi',
  'user.suspended': 'Foydalanuvchi hisobi bloklandi',
  'user.suspend': 'Foydalanuvchi hisobi bloklandi',
  user_blocked: 'Foydalanuvchi bloklandi',
  'user.block': 'Foydalanuvchi bloklandi',
  'user.blocked': 'Foydalanuvchi bloklandi',
  user_unblocked: 'Foydalanuvchi blokdan chiqarildi',
  'user.unblock': 'Foydalanuvchi blokdan chiqarildi',
  'user.unblocked': 'Foydalanuvchi blokdan chiqarildi',
  user_password_reset: 'Foydalanuvchi paroli tiklandi',
  'user.password_reset': 'Foydalanuvchi paroli tiklandi',
  user_password_changed: "Foydalanuvchi paroli o'zgartirildi",
  'user.password_changed': "Foydalanuvchi paroli o'zgartirildi",

  // Booking actions
  'booking.terms_accepted': 'Foydalanuvchi bron shartlarini qabul qildi',
  booking_terms_accepted: 'Foydalanuvchi bron shartlarini qabul qildi',
  booking_created: 'Yangi bron yaratildi',
  'booking.create': 'Yangi bron yaratildi',
  booking_cancelled: 'Bron bekor qilindi',
  'booking.cancel': 'Bron bekor qilindi',
  'booking.admin_cancel': 'Bron administrator tomonidan bekor qilindi',
  booking_admin_cancel: 'Bron administrator tomonidan bekor qilindi',
  'booking.status': "Bron holati o'zgartirildi",
  booking_status: "Bron holati o'zgartirildi",
  'booking.completed': 'Bron yakunlandi',
  booking_completed: 'Bron yakunlandi',
  'booking.confirmed': 'Bron tasdiqlandi',
  booking_confirmed: 'Bron tasdiqlandi',
  'booking.expired': 'Bron muddati tugadi',
  booking_expired: 'Bron muddati tugadi',

  // Availability / Room inventory
  'availability.block': 'Xona inventari bron qilish uchun yopildi',
  availability_block: 'Xona inventari bron qilish uchun yopildi',
  'availability.unblock': 'Xona inventari bron qilish uchun ochildi',
  availability_unblock: 'Xona inventari bron qilish uchun ochildi',
  'room_inventory.block': 'Xona inventari bron qilish uchun yopildi',
  'room_inventory.unblock': 'Xona inventari bron qilish uchun ochildi',

  // Admin user & staff management
  'admin_user.create': 'Admin foydalanuvchisi yaratildi',
  admin_user_create: 'Admin foydalanuvchisi yaratildi',
  'admin_user.update': "Admin foydalanuvchisi ma'lumotlari yangilandi",
  admin_user_update: "Admin foydalanuvchisi ma'lumotlari yangilandi",
  'admin_user.status': "Admin foydalanuvchisi holati o'zgartirildi",
  admin_user_status: "Admin foydalanuvchisi holati o'zgartirildi",
  staff_created: 'Xodim hisobi yaratildi',
  'staff.create': 'Xodim hisobi yaratildi',
  staff_reactivated: 'Xodim qayta faollashtirildi',
  'staff.reactivate': 'Xodim qayta faollashtirildi',
  staff_password_changed: "Xodim paroli o'zgartirildi",
  staff_password_reset: 'Xodim paroli tiklandi',
  staff_permissions_updated: 'Xodim ruxsatlari yangilandi',
  staff_sessions_revoked: 'Xodim sessiyalari bekor qilindi',
  staff_totp_enabled: 'Xodimga ikki bosqichli autentifikatsiya (TOTP) yoqildi',
  staff_totp_disabled: "Xodimning ikki bosqichli autentifikatsiyasi o'chirildi",
  staff_totp_reset:
    'Xodimning ikki bosqichli autentifikatsiyasi qayta tiklandi',

  // User management
  'user.terms_accepted': 'Foydalanuvchi xizmat shartlarini qabul qildi',
  user_terms_accepted: 'Foydalanuvchi xizmat shartlarini qabul qildi',
  'user.admin_delete': "Foydalanuvchi o'chirildi",
  user_admin_delete: "Foydalanuvchi o'chirildi",
  'user.admin_delete_guest': "Mehmon foydalanuvchi o'chirildi",
  user_admin_delete_guest: "Mehmon foydalanuvchi o'chirildi",
  'user.admin_message': 'Foydalanuvchiga xabar yuborildi',
  user_admin_message: 'Foydalanuvchiga xabar yuborildi',
  'user.bonus_adjustment': "Foydalanuvchi bonus balansi o'zgartirildi",
  user_bonus_adjustment: "Foydalanuvchi bonus balansi o'zgartirildi",
  user_registered: "Yangi foydalanuvchi ro'yxatdan o'tdi",
  'user.register': "Yangi foydalanuvchi ro'yxatdan o'tdi",
  'user.status': "Foydalanuvchi holati o'zgartirildi",
  user_status: "Foydalanuvchi holati o'zgartirildi",
  'user.profile_update': 'Foydalanuvchi profili yangilandi',
  user_profile_update: 'Foydalanuvchi profili yangilandi',

  // Partner actions
  partner_request: 'Yangi hamkor arizasi tushdi',
  'partner.request': 'Yangi hamkor arizasi tushdi',
  'partner.moderation': "Hamkor arizasi ko'rib chiqildi",
  partner_moderation: "Hamkor arizasi ko'rib chiqildi",
  'partner.status': "Hamkor holati o'zgartirildi",
  partner_status: "Hamkor holati o'zgartirildi",
  'partner.commission': "Hamkor komissiya foizi o'zgartirildi",
  partner_commission: "Hamkor komissiya foizi o'zgartirildi",
  'partner.adjustment': 'Hamkor balansiga tuzatish kiritildi',
  partner_adjustment: 'Hamkor balansiga tuzatish kiritildi',
  'partner.delete': "Hamkor o'chirildi",
  partner_delete: "Hamkor o'chirildi",
  'partner.password_login': 'Hamkor tizimga kirdi',
  partner_password_login: 'Hamkor tizimga kirdi',
  'partner.password_set': "Hamkor paroli o'rnatildi",
  partner_password_set: "Hamkor paroli o'rnatildi",
  'partner.email_verified': 'Hamkor elektron pochtasi tasdiqlandi',
  partner_email_verified: 'Hamkor elektron pochtasi tasdiqlandi',
  'partner.registration_phone_verified': 'Hamkor telefon raqami tasdiqlandi',
  partner_registration_phone_verified: 'Hamkor telefon raqami tasdiqlandi',
  seller_application_submitted: 'Yangi sotuvchi arizasi topshirildi',
  seller_application_approved: 'Sotuvchi arizasi tasdiqlandi',
  seller_application_rejected: 'Sotuvchi arizasi rad etildi',
  seller_suspended: "Sotuvchi faoliyati to'xtatildi",
  seller_reinstated: 'Sotuvchi faoliyati qayta tiklandi',

  // Reviews
  'review.publish': 'Sharh tasdiqlandi va chop etildi',
  review_published: 'Sharh tasdiqlandi va chop etildi',
  'review.hide': 'Sharh yashirildi',
  review_hidden: 'Sharh yashirildi',
  'review.approve': 'Sharh tasdiqlandi',
  review_approved: 'Sharh tasdiqlandi',
  'review.reject': 'Sharh rad etildi',
  review_rejected: 'Sharh rad etildi',
  'review.delete': "Sharh o'chirildi",
  review_deleted: "Sharh o'chirildi",

  // Promotions
  'promotion.approve': 'Chegirma arizasi tasdiqlandi',
  promotion_approved: 'Chegirma arizasi tasdiqlandi',
  'promotion.reject': 'Chegirma arizasi rad etildi',
  promotion_rejected: 'Chegirma arizasi rad etildi',
  'promotion.delete': "Chegirma arizasi o'chirildi",
  promotion_deleted: "Chegirma arizasi o'chirildi",
  'promotion.create': 'Yangi aksiya/chegirma yaratildi',
  promotion_created: 'Yangi aksiya/chegirma yaratildi',

  // Refunds & Payments
  'refund.approve': "To'lovni qaytarish tasdiqlandi",
  refund_approved: "To'lovni qaytarish tasdiqlandi",
  'refund.reject': "To'lovni qaytarish rad etildi",
  refund_rejected: "To'lovni qaytarish rad etildi",
  'refund.retry': "To'lovni qaytarish qayta urinildi",
  refund_retried: "To'lovni qaytarish qayta urinildi",
  refund_created: "To'lovni qaytarish so'rovi yaratildi",
  'refund.create': "To'lovni qaytarish so'rovi yaratildi",
  payment_created: "To'lov yaratildi",
  'payment.create': "To'lov yaratildi",
  payment_failed: "To'lov amalga oshmadi (xatolik)",
  'payment.failed': "To'lov amalga oshmadi (xatolik)",
  payment_succeeded: "To'lov muvaffaqiyatli amalga oshirildi",
  'payment.success': "To'lov muvaffaqiyatli amalga oshirildi",
  payout_created: "Mablag' yechish so'rovi yaratildi",
  'payout.create': "Mablag' yechish so'rovi yaratildi",
  payout_succeeded: "Mablag' muvaffaqiyatli yechib berildi",
  'payout.success': "Mablag' muvaffaqiyatli yechib berildi",
  payout_failed: "Mablag' yechishda xatolik yuz berdi",
  'payout.failed': "Mablag' yechishda xatolik yuz berdi",

  // Contracts & Services
  contract_created: 'Yangi shartnoma tuzildi',
  'contract.create': 'Yangi shartnoma tuzildi',
  contract_accepted: 'Shartnoma qabul qilindi',
  'contract.accept': 'Shartnoma qabul qilindi',
  contract_rejected: 'Shartnoma rad etildi',
  'contract.reject': 'Shartnoma rad etildi',
  contract_cancelled: 'Shartnoma bekor qilindi',
  'contract.cancel': 'Shartnoma bekor qilindi',
  contract_completed: 'Shartnoma yakunlandi',
  'contract.complete': 'Shartnoma yakunlandi',
  service_approved: 'Xizmat tasdiqlandi va chop etildi',
  'service.approve': 'Xizmat tasdiqlandi va chop etildi',
  service_rejected: 'Xizmat rad etildi',
  'service.reject': 'Xizmat rad etildi',
  service_force_paused: "Xizmat majburiy to'xtatildi",
  'service.pause': "Xizmat to'xtatildi",

  // Disputes
  dispute_opened: 'Nizo ochildi',
  'dispute.open': 'Nizo ochildi',
  dispute_review_started: "Nizoni ko'rib chiqish boshlandi",
  dispute_evidence_added: "Nizoga dalil qo'shildi",
  dispute_resolved: 'Nizo hal qilindi',
  'dispute.resolve': 'Nizo hal qilindi',
  dispute_rejected: 'Nizo rad etildi',
  'dispute.reject': 'Nizo rad etildi',
  dispute_cancelled: 'Nizo bekor qilindi',
  'dispute.cancel': 'Nizo bekor qilindi',

  // System & Settings
  'settings.update': 'Sozlamalar yangilandi',
  settings_update: 'Sozlamalar yangilandi',
  'developer.api_key_create': 'Dasturchi API kaliti yaratildi',
  'developer.api_key_revoke': 'Dasturchi API kaliti bekor qilindi',
  complaint: 'Yangi shikoyat/murojaat tushdi',
};

const ENTITY_LABELS: Record<string, string> = {
  booking: 'Foydalanuvchi bron',
  bookings: 'Foydalanuvchi bron',
  user: 'Foydalanuvchi',
  users: 'Foydalanuvchi',
  admin_user: 'Admin foydalanuvchisi',
  admin_users: 'Admin foydalanuvchisi',
  admin: 'Admin',
  partner: 'Hamkor',
  partners: 'Hamkor',
  hotel: 'Mehmonxona',
  hotels: 'Mehmonxona',
  room: 'Xona',
  rooms: 'Xona',
  room_inventory: 'Xona inventari',
  review: 'Sharh',
  reviews: 'Sharh',
  promotion: 'Chegirma',
  promotions: 'Chegirma',
  payment: "To'lov",
  payments: "To'lov",
  refund: 'Mablag‘ qaytarish',
  refunds: 'Mablag‘ qaytarish',
  ticket: 'Murojaat',
  tickets: 'Murojaat',
  support: "Qo'llab-quvvatlash",
  settings: 'Sozlamalar',
  developer: 'Dasturchi sozlamalari',
  outbox: 'Xabarnoma (Outbox)',
  outbox_event: 'Xabarnoma (Outbox)',
  contract: 'Shartnoma',
  contracts: 'Shartnoma',
  dispute: 'Nizo',
  disputes: 'Nizo',
  service: 'Xizmat',
  services: 'Xizmat',
  staff: 'Xodim',
  staff_member: 'Xodim',
  category: 'Kategoriya',
  payout: "Mablag' yechish",
  ledger: 'Buxgalteriya daftari',
  ledger_transaction: 'Buxgalteriya yozuvi',
  milestone: 'Bosqich',
};

const VERB_LABELS: Record<string, string> = {
  create: 'yaratildi',
  created: 'yaratildi',
  update: 'yangilandi',
  updated: 'yangilandi',
  delete: "o'chirildi",
  deleted: "o'chirildi",
  cancel: 'bekor qilindi',
  cancelled: 'bekor qilindi',
  approve: 'tasdiqlandi',
  approved: 'tasdiqlandi',
  reject: 'rad etildi',
  rejected: 'rad etildi',
  publish: 'chop etildi',
  published: 'chop etildi',
  hide: 'yashirildi',
  hidden: 'yashirildi',
  block: 'bloklandi',
  blocked: 'bloklandi',
  unblock: 'blokdan chiqarildi',
  unblocked: 'blokdan chiqarildi',
  suspend: 'bloklandi',
  suspended: 'bloklandi',
  reactivate: 'qayta faollashtirildi',
  reactivated: 'qayta faollashtirildi',
  status: "holati o'zgartirildi",
  terms_accepted: 'shartlari qabul qilindi',
  login: 'tizimga kirdi',
  logout: 'tizimdan chiqdi',
  revoke: 'bekor qilindi',
  revoked: 'bekor qilindi',
  reset: 'tiklandi',
  fail: "muvaffaqiyatsiz bo'ldi",
  failed: "muvaffaqiyatsiz bo'ldi",
  dead: "yetkazib bo'lmadi",
  success: 'muvaffaqiyatli bajarildi',
  succeeded: 'muvaffaqiyatli bajarildi',
  open: 'ochildi',
  opened: 'ochildi',
  close: 'yopildi',
  closed: 'yopildi',
  submit: 'topshirildi',
  submitted: 'topshirildi',
  process: 'qayta ishlandi',
  processed: 'qayta ishlandi',
  resolve: 'hal qilindi',
  resolved: 'hal qilindi',
};

function parseUnknownActionToUzbek(action: string): string {
  const parts = action.split(/[._]/).filter(Boolean);
  if (parts.length === 0) return 'Admin harakati';

  const first = parts[0]?.toLowerCase();
  const last = parts[parts.length - 1]?.toLowerCase();

  // 3 qismli iboralar uchun (masalan outbox_event_dead)
  const firstTwo = parts.slice(0, 2).join('_').toLowerCase();
  const entity =
    (firstTwo && ENTITY_LABELS[firstTwo]) ||
    (first && ENTITY_LABELS[first]) ||
    null;
  const verb = (last && VERB_LABELS[last]) || null;

  if (verb && parts.length > 1) {
    const subject = entity || first;
    return `${subject} ${verb}`;
  }

  if (entity && parts.length === 1) {
    return entity;
  }

  return action.toLowerCase().replace(/[._]+/g, ' ').trim();
}

/**
 * Harakat kaliti va uning metama'lumotlariga qarab inson tushunadigan
 * chiroyli o'zbekcha matn hosil qiladi.
 */
export function formatAuditAction(
  rawAction: string,
  metadata?: Record<string, unknown> | null,
  newValue?: Record<string, unknown> | null,
): string {
  const action = String(rawAction || '').trim();
  if (!action) {
    return 'Admin harakati';
  }

  const normalized = action.toLowerCase();
  const normalizedUnderscore = normalized.replace(/\./g, '_');
  const normalizedDot = normalized.replace(/_/g, '.');

  // Dinamik metama'lumotlar bilan boyitilgan holatlar
  if (
    normalizedDot === 'partner.moderation' ||
    normalizedUnderscore === 'partner_moderation'
  ) {
    const status = String(metadata?.status || '').toLowerCase();
    if (status === 'approved') return 'Hamkor arizasi tasdiqlandi';
    if (status === 'rejected') return 'Hamkor arizasi rad etildi';
    return "Hamkor arizasi ko'rib chiqildi";
  }

  if (
    normalizedDot === 'settings.update' ||
    normalizedUnderscore === 'settings_update'
  ) {
    const group = String(metadata?.group || '').toLowerCase();
    if (group === 'general') return 'Umumiy sozlamalar yangilandi';
    if (group === 'finance') return 'Moliya sozlamalari yangilandi';
    if (group === 'notifications')
      return 'Bildirishnoma sozlamalari yangilandi';
    return group ? `${group} sozlamalari yangilandi` : 'Sozlamalar yangilandi';
  }

  if (
    normalizedDot === 'partner.status' ||
    normalizedUnderscore === 'partner_status'
  ) {
    const status = metadata?.status ? String(metadata.status) : null;
    return status
      ? `Hamkor holati o'zgartirildi: ${status}`
      : "Hamkor holati o'zgartirildi";
  }

  if (
    normalizedDot === 'admin_user.status' ||
    normalizedUnderscore === 'admin_user_status'
  ) {
    const status = String(
      metadata?.status ?? newValue?.status ?? '',
    ).toLowerCase();
    if (status === 'blocked' || status === 'suspended')
      return 'Admin foydalanuvchisi bloklandi';
    if (status === 'active') return 'Admin foydalanuvchisi faollashtirildi';
    return "Admin foydalanuvchisi holati o'zgartirildi";
  }

  if (
    normalizedDot === 'user.status' ||
    normalizedUnderscore === 'user_status'
  ) {
    const status = String(
      metadata?.status ?? newValue?.status ?? '',
    ).toLowerCase();
    if (status === 'blocked' || status === 'suspended')
      return 'Foydalanuvchi bloklandi';
    if (status === 'active') return 'Foydalanuvchi faollashtirildi';
    return "Foydalanuvchi holati o'zgartirildi";
  }

  // Lug'at orqali aniqlash (turli xil separator va registr variantlarini tekshirish)
  if (AUDIT_ACTION_UZBEK_LABELS[action]) {
    return AUDIT_ACTION_UZBEK_LABELS[action];
  }
  if (AUDIT_ACTION_UZBEK_LABELS[normalized]) {
    return AUDIT_ACTION_UZBEK_LABELS[normalized];
  }
  if (AUDIT_ACTION_UZBEK_LABELS[normalizedDot]) {
    return AUDIT_ACTION_UZBEK_LABELS[normalizedDot];
  }
  if (AUDIT_ACTION_UZBEK_LABELS[normalizedUnderscore]) {
    return AUDIT_ACTION_UZBEK_LABELS[normalizedUnderscore];
  }

  // Agar allaqachon inson tilida bo'lsa (bo'shliqlar bor, nuqta/chiziqcha yo'q, va ALL CAPS emas)
  if (
    action.includes(' ') &&
    !action.includes('.') &&
    !action.includes('_') &&
    action !== action.toUpperCase()
  ) {
    return action;
  }

  // Noma'lum harakatlar uchun avtomatik parslash
  return parseUnknownActionToUzbek(action);
}

/**
 * DB'dan qaytgan har bir audit_logs qatorini formatlaydi:
 * - `action_label`: har doim inson tushunadigan o'zbekcha matn.
 * - `raw_action`: har doim DB'dagi xom action kodi.
 * - `action`: frontend (web-admin) bilan 100% moslik uchun — agar action
 *   frontend'dagi switch-case'da mavjud bo'lsa (15 ta kalit), xom kalit saqlanadi
 *   (frontend ikonkalari va metama'lumotlari to'g'ri ishlashi uchun);
 *   aks holda (masalan: `booking.terms_accepted`, `admin_user.create`),
 *   o'zbekcha inson tushunadigan matn beriladi.
 * - `description`, `message`: o'zbekcha matn nusxasi.
 */
export function formatAuditRow(row: DbRow): DbRow {
  const rawAction = String(row.action ?? '').trim();
  const normalized = rawAction.toLowerCase();
  const metadata = (
    row.metadata && typeof row.metadata === 'object' ? row.metadata : null
  ) as Record<string, unknown> | null;
  const newValue = (
    row.new_value && typeof row.new_value === 'object' ? row.new_value : null
  ) as Record<string, unknown> | null;

  const actionLabel = formatAuditAction(rawAction, metadata, newValue);
  const isFrontendHandled =
    FRONTEND_HANDLED_AUDIT_ACTIONS.has(rawAction) ||
    FRONTEND_HANDLED_AUDIT_ACTIONS.has(normalized);

  const actionForUi = isFrontendHandled
    ? FRONTEND_HANDLED_AUDIT_ACTIONS.has(rawAction)
      ? rawAction
      : normalized
    : actionLabel;

  return {
    ...row,
    action: actionForUi,
    action_label: actionLabel,
    raw_action: rawAction,
    description: actionLabel,
    message: actionLabel,
  };
}
