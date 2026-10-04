import {
  formatAuditAction,
  formatAuditRow,
  FRONTEND_HANDLED_AUDIT_ACTIONS,
} from './audit-formatter';

describe('audit-formatter', () => {
  describe('formatAuditAction', () => {
    it('formats booking.terms_accepted to Uzbek containing lowercase "bron"', () => {
      const formatted = formatAuditAction('booking.terms_accepted');
      expect(formatted).toBe('Foydalanuvchi bron shartlarini qabul qildi');
      // Crucial for frontend toActivityLog to pick type='booking_created' (CalendarPlus icon)
      expect(formatted.includes('bron')).toBe(true);
    });

    it('formats admin_user.create to Uzbek', () => {
      const formatted = formatAuditAction('admin_user.create');
      expect(formatted).toBe('Admin foydalanuvchisi yaratildi');
    });

    it('formats availability actions containing "bron" so web-admin assigns booking icon', () => {
      const block = formatAuditAction('availability.block');
      const unblock = formatAuditAction('availability.unblock');
      expect(block).toBe('Xona inventari bron qilish uchun yopildi');
      expect(unblock).toBe('Xona inventari bron qilish uchun ochildi');
      expect(block.includes('bron')).toBe(true);
      expect(unblock.includes('bron')).toBe(true);
    });

    it('formats partner.moderation with status-specific Uzbek phrasing', () => {
      expect(
        formatAuditAction('partner.moderation', { status: 'approved' }),
      ).toBe('Hamkor arizasi tasdiqlandi');
      expect(
        formatAuditAction('partner.moderation', { status: 'rejected' }),
      ).toBe('Hamkor arizasi rad etildi');
      expect(formatAuditAction('partner.moderation', {})).toBe(
        "Hamkor arizasi ko'rib chiqildi",
      );
    });

    it('formats settings.update with group-specific Uzbek phrasing', () => {
      expect(formatAuditAction('settings.update', { group: 'finance' })).toBe(
        'Moliya sozlamalari yangilandi',
      );
      expect(formatAuditAction('settings.update', { group: 'general' })).toBe(
        'Umumiy sozlamalar yangilandi',
      );
      expect(
        formatAuditAction('settings.update', { group: 'notifications' }),
      ).toBe('Bildirishnoma sozlamalari yangilandi');
      expect(formatAuditAction('settings.update', {})).toBe(
        'Sozlamalar yangilandi',
      );
    });

    it('formats admin_user.status and user.status dynamically', () => {
      expect(
        formatAuditAction('admin_user.status', { status: 'blocked' }),
      ).toBe('Admin foydalanuvchisi bloklandi');
      expect(formatAuditAction('admin_user.status', { status: 'active' })).toBe(
        'Admin foydalanuvchisi faollashtirildi',
      );
      expect(formatAuditAction('user.status', { status: 'blocked' })).toBe(
        'Foydalanuvchi bloklandi',
      );
      expect(formatAuditAction('user.status', { status: 'active' })).toBe(
        'Foydalanuvchi faollashtirildi',
      );
    });

    it('formats review, promotion, and refund actions correctly', () => {
      expect(formatAuditAction('review.publish')).toBe(
        'Sharh tasdiqlandi va chop etildi',
      );
      expect(formatAuditAction('review.hide')).toBe('Sharh yashirildi');
      expect(formatAuditAction('promotion.approve')).toBe(
        'Chegirma arizasi tasdiqlandi',
      );
      expect(formatAuditAction('promotion.reject')).toBe(
        'Chegirma arizasi rad etildi',
      );
      expect(formatAuditAction('refund.approve')).toBe(
        "To'lovni qaytarish tasdiqlandi",
      );
      expect(formatAuditAction('refund.reject')).toBe(
        "To'lovni qaytarish rad etildi",
      );
    });

    it('formats exact screenshot actions in uppercase SNAKE_CASE to natural Uzbek', () => {
      expect(formatAuditAction('OUTBOX_EVENT_DEAD')).toBe(
        "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
      );
      expect(formatAuditAction('USER_REACTIVATED')).toBe(
        'Foydalanuvchi hisobi faollashtirildi',
      );
      expect(formatAuditAction('USER_SUSPENDED')).toBe(
        'Foydalanuvchi hisobi bloklandi',
      );
      expect(formatAuditAction('USER_BLOCKED')).toBe('Foydalanuvchi bloklandi');
      expect(formatAuditAction('USER_PASSWORD_RESET')).toBe(
        'Foydalanuvchi paroli tiklandi',
      );
      expect(formatAuditAction('CONTRACT_CREATED')).toBe(
        'Yangi shartnoma tuzildi',
      );
      expect(formatAuditAction('PAYMENT_FAILED')).toBe(
        "To'lov amalga oshmadi (xatolik)",
      );
      expect(formatAuditAction('BOOKING_CANCELLED')).toBe('Bron bekor qilindi');
    });

    it('normalizes actions across dots, underscores and case variants', () => {
      expect(formatAuditAction('outbox_event_dead')).toBe(
        "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
      );
      expect(formatAuditAction('outbox_event.dead')).toBe(
        "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
      );
      expect(formatAuditAction('user.reactivated')).toBe(
        'Foydalanuvchi hisobi faollashtirildi',
      );
      expect(formatAuditAction('user_suspended')).toBe(
        'Foydalanuvchi hisobi bloklandi',
      );
      expect(formatAuditAction('BOOKING.TERMS_ACCEPTED')).toBe(
        'Foydalanuvchi bron shartlarini qabul qildi',
      );
    });

    it('parses unknown dot/underscore actions gracefully', () => {
      expect(formatAuditAction('hotel.create')).toBe('Mehmonxona yaratildi');
      expect(formatAuditAction('payment.update')).toBe("To'lov yangilandi");
      expect(formatAuditAction('tour.cancel')).toBe('tour bekor qilindi');
      expect(formatAuditAction('custom_entity_action')).toBe(
        'custom entity action',
      );
    });

    it('handles empty and whitespace-only actions', () => {
      expect(formatAuditAction('')).toBe('Admin harakati');
      expect(formatAuditAction('   ')).toBe('Admin harakati');
    });
  });

  describe('formatAuditRow', () => {
    it('replaces unhandled action (e.g. booking.terms_accepted) with Uzbek label in action field', () => {
      const row = {
        id: '123',
        actor_type: 'user',
        action: 'booking.terms_accepted',
        entity_type: 'bookings',
        entity_id: '456',
        metadata: { terms_version: '2026.1' },
      };

      const formatted = formatAuditRow(row);

      expect(formatted.action).toBe(
        'Foydalanuvchi bron shartlarini qabul qildi',
      );
      expect(formatted.action_label).toBe(
        'Foydalanuvchi bron shartlarini qabul qildi',
      );
      expect(formatted.raw_action).toBe('booking.terms_accepted');
      expect(formatted.description).toBe(
        'Foydalanuvchi bron shartlarini qabul qildi',
      );
      expect(formatted.message).toBe(
        'Foydalanuvchi bron shartlarini qabul qildi',
      );
      expect(formatted.id).toBe('123');
    });

    it('replaces unhandled admin_user.create with Uzbek label in action field', () => {
      const row = {
        id: '789',
        actor_type: 'admin',
        action: 'admin_user.create',
        entity_type: 'admin_user',
        entity_id: '999',
      };

      const formatted = formatAuditRow(row);

      expect(formatted.action).toBe('Admin foydalanuvchisi yaratildi');
      expect(formatted.action_label).toBe('Admin foydalanuvchisi yaratildi');
      expect(formatted.raw_action).toBe('admin_user.create');
    });

    it('formats exact screenshot actions in formatAuditRow (OUTBOX_EVENT_DEAD, USER_REACTIVATED)', () => {
      const row1 = {
        id: 'outbox-1',
        actor_type: 'worker',
        action: 'OUTBOX_EVENT_DEAD',
        entity_type: 'outbox_events',
        entity_id: '01a0fcab-1111-2222-3333-444455556666',
      };
      const formatted1 = formatAuditRow(row1);
      expect(formatted1.action).toBe(
        "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
      );
      expect(formatted1.action_label).toBe(
        "Xabarnoma yetkazib bo'lmadi (DLQ xatosi)",
      );
      expect(formatted1.raw_action).toBe('OUTBOX_EVENT_DEAD');

      const row2 = {
        id: 'user-reactivate-1',
        actor_type: 'admin',
        action: 'USER_REACTIVATED',
        entity_type: 'users',
        entity_id: '01a0ec88-1111-2222-3333-444455556666',
      };
      const formatted2 = formatAuditRow(row2);
      expect(formatted2.action).toBe('Foydalanuvchi hisobi faollashtirildi');
      expect(formatted2.action_label).toBe(
        'Foydalanuvchi hisobi faollashtirildi',
      );
      expect(formatted2.raw_action).toBe('USER_REACTIVATED');
    });

    it('preserves raw key in action field for the 15 actions already handled by frontend switch-case', () => {
      for (const actionKey of FRONTEND_HANDLED_AUDIT_ACTIONS) {
        const row = {
          id: 'test-id',
          action: actionKey,
          metadata: { status: 'approved' },
        };
        const formatted = formatAuditRow(row);
        // Frontend expects exact key to preserve icon (e.g. partner -> Building, cancel -> XCircle)
        expect(formatted.action).toBe(actionKey);
        expect(formatted.raw_action).toBe(actionKey);
        // But action_label is always in Uzbek!
        expect(typeof formatted.action_label).toBe('string');
        expect(formatted.action_label.length).toBeGreaterThan(0);
      }
    });

    it('handles null/missing action and metadata safely', () => {
      const row = {
        id: 'empty-test',
        action: null,
      };

      const formatted = formatAuditRow(row);
      expect(formatted.action).toBe('Admin harakati');
      expect(formatted.action_label).toBe('Admin harakati');
      expect(formatted.raw_action).toBe('');
    });
  });
});
