/**
 * Google Analytics 4 (GA4) va Custom Event Analytics Tracker Servisi.
 */

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "js",
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || "G-GNQBLTRTVF";

export type AnalyticsEventName =
  | "page_view"
  | "search_performed"
  | "hotel_viewed"
  | "booking_started"
  | "payment_method_selected"
  | "booking_completed";

export interface AnalyticsEventParams {
  page_title?: string;
  page_location?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  hotelId?: string;
  hotelName?: string;
  roomId?: string;
  totalSum?: number;
  priceSum?: number;
  paymentMethod?: string;
  bookingId?: string;
  [key: string]: unknown;
}

/**
 * Universal Event Dispatcher — GA4 hamda Console log uchun.
 */
function trackEvent(
  eventName: AnalyticsEventName,
  params: AnalyticsEventParams = {}
): void {
  if (typeof window === "undefined") return;

  // 1) GA4 Event Dispatch
  if (window.gtag) {
    window.gtag("event", eventName, params);
  }

  // 2) Dev Mode Debug Logging
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics Event] ${eventName}`, params);
  }
}

/** Sahifa navigatsiyasida page_view yuborish. */
export function trackPageView(url: string, title?: string): void {
  trackEvent("page_view", {
    page_location: url,
    page_title: title || document.title,
  });
}

/** Qidiruv amalga oshirilganda. */
export function trackSearchPerformed(params: {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}): void {
  trackEvent("search_performed", params);
}

/** Bron qilish boshlanganda. */
export function trackBookingStarted(params: {
  hotelId?: string;
  roomId?: string;
  totalSum?: number;
}): void {
  trackEvent("booking_started", params);
}

/** To'lov usuli tanlanganda. */
export function trackPaymentMethodSelected(params: {
  paymentMethod: string;
  bookingId?: string;
}): void {
  trackEvent("payment_method_selected", params);
}

/** Bron va to'lov muvaffaqiyatli yakunlanganda (Conversion Funnel). */
export function trackBookingCompleted(params: {
  bookingId: string;
  totalSum: number;
  paymentMethod: string;
}): void {
  trackEvent("booking_completed", params);
}
