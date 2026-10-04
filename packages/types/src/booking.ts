export enum BookingStatus {
  PENDING = 'PENDING',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  AWAITING_PARTNER_CONFIRMATION = 'AWAITING_PARTNER_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

export type ApiBookingStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'awaiting_partner_confirmation'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'expired';

export enum BookingType {
  HOTEL = 'HOTEL',
  BUS = 'BUS',
}

export type ApiBookingType = 'hotel' | 'bus';

export enum PaymentMethod {
  CLICK = 'CLICK',
  PAYME = 'PAYME',
  UZCARD = 'UZCARD',
  HUMO = 'HUMO',
  CASH = 'CASH',
}

export type ApiPaymentMethod = 'click' | 'payme' | 'uzcard' | 'humo' | 'cash';

export enum ConfirmationMode {
  INSTANT_CONFIRMATION = 'INSTANT_CONFIRMATION',
  REQUEST_CONFIRMATION = 'REQUEST_CONFIRMATION',
}

export type ApiConfirmationMode =
  | 'instant_confirmation'
  | 'request_confirmation';

export interface Booking {
  id: string;
  userId?: string;
  user_id?: string;
  hotelId?: string;
  hotel_id?: string | null;
  roomTypeId?: string;
  room_type_id?: string | null;
  trip_id?: string | null;
  partner_organization_id?: string | null;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  totalPrice?: number;
  total_amount?: string | number;
  status: BookingStatus | ApiBookingStatus;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  bookingNumber?: string;
  booking_number?: string;
  type?: BookingType | ApiBookingType;
  paymentMethod?: PaymentMethod | ApiPaymentMethod;
  payment_method?: ApiPaymentMethod;
  confirmationMode?: ConfirmationMode | ApiConfirmationMode;
  confirmation_mode?: ApiConfirmationMode;
  currency?: 'UZS';
  commissionAmount?: number;
  commission_amount?: string | number;
  partnerPayable?: number;
  partner_payable?: string | number;
  subtotal?: string | number;
  discount_amount?: string | number;
  bonus_amount?: string | number;
  service_fee?: string | number;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  price_snapshot?: unknown;
  policy_snapshot?: unknown;
}

export interface CreateBookingDto {
  hotelId: string;
  roomId?: string;
  roomTypeId?: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  paymentMethod?: ApiPaymentMethod;
  payment_method?: ApiPaymentMethod | string;
  otp_code?: string;
  otpCode?: string;
  challenge_id?: string;
  challengeId?: string;
  verification_token?: string;
  verificationToken?: string;
}

export interface SendCashOtpDto {
  phone: string;
}

export interface SendCashOtpResponse {
  challenge_id: string;
  phone: string;
  resend_after: number;
  dev_code?: string;
}

export interface VerifyCashOtpDto {
  phone: string;
  otp_code?: string;
  otpCode?: string;
  challenge_id?: string;
  challengeId?: string;
  booking_id?: string;
  bookingId?: string;
}

export interface VerifyCashOtpResponse {
  success: boolean;
  message: string;
  verified?: boolean;
  phone?: string;
  verification_token?: string;
  status?: string;
  booking?: Booking;
  payment?: unknown;
  guestAccessToken?: string;
}

export interface ConfirmCashOtpDto {
  otp_code?: string;
  otpCode?: string;
  challenge_id?: string;
  challengeId?: string;
  phone?: string;
}

export interface ConfirmCashBookingResponse {
  booking: Booking;
  payment?: unknown;
  guestAccessToken?: string;
}
