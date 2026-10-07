export enum PaymentStatus {
  PENDING = "PENDING",
  AWAITING_CASH = "AWAITING_CASH",
  PROCESSING = "PROCESSING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export interface Payment {
  id: string;
  bookingId: string;
  provider: "click" | "payme" | "uzcard" | "humo" | "cash" | "visa" | "mastercard";
  status: PaymentStatus;
  amount: number;
  currency: "UZS";
  paymentUrl?: string;
  providerReference?: string;
  cardScheme?: "humo" | "uzcard" | "visa" | "mastercard";
  baseAmount?: number;
  feeRate?: number;
  feeAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export enum RefundStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PROCESSING = "PROCESSING",
  PAID = "PAID",
}

export interface Refund {
  id: string;
  bookingId: string;
  userId: string;
  status: RefundStatus;
  requestedAmount: number;
  currency: "UZS";
  reason?: string;
  createdAt: string;
  updatedAt: string;
}
