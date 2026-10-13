"use client";

import React, { useState, useEffect } from "react";
import { cashOtpVerifyAction, cashOtpResendAction } from "@/lib/services/booking/actions";
import { CodeSlots } from "@/components/reactbits/CodeSlots";

export interface CashOtpDict {
  title: string;
  description: string;
  inputPlaceholder: string;
  timerLabel: string;
  resendButton: string;
  verifyButton: string;
  cancelButton: string;
  verifying: string;
  errors: {
    INVALID_OTP: string;
    OTP_EXPIRED: string;
    TOO_MANY_ATTEMPTS: string;
    RESEND_COOLDOWN: string;
    BOOKING_CANCELLED: string;
    INCOMPLETE_CODE: string;
    UNKNOWN: string;
    [key: string]: string; // Fallback xatolar uchun
  };
}

export interface CashOtpModalProps {
  isOpen: boolean;
  bookingId?: string;
  phone?: string;
  maskedPhone?: string;
  challengeId?: string;
  initialExpiresIn?: number;
  dict: CashOtpDict;
  onSuccess: (result: { bookingId?: string; verificationToken?: string }) => void;
  onClose: () => void;
}

export function CashOtpModal({
  isOpen,
  bookingId,
  phone = "",
  maskedPhone,
  challengeId,
  initialExpiresIn = 180,
  dict,
  onSuccess,
  onClose,
}: CashOtpModalProps) {
  const [otp, setOtp] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(initialExpiresIn);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorCode, setErrorCode] = useState<keyof CashOtpDict["errors"] | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOtp("");
      setTimeLeft(initialExpiresIn);
      setResendCooldown(60);
      setErrorCode(null);
      setIsLoading(false);
      setIsSuccess(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, initialExpiresIn]);

  if (!isOpen) return null;

  const handleVerify = async (codeToVerify?: string) => {
    const code = (typeof codeToVerify === "string" ? codeToVerify : otp).trim();
    if (code.length < 6) {
      setErrorCode("INCOMPLETE_CODE");
      return;
    }

    setIsLoading(true);
    setErrorCode(null);
    try {
      const cleanPhone = (phone ? phone.replace(/[^\d+]/g, "") : maskedPhone || "").trim();
      const result = await cashOtpVerifyAction({
        booking_id: bookingId,
        phone: cleanPhone,
        otp_code: code,
        challenge_id: challengeId,
      });
      if (result?.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess({
            bookingId: result.bookingId || bookingId,
            verificationToken: result.verificationToken,
          });
        }, 600);
      } else {
        setErrorCode((result?.error as keyof CashOtpDict["errors"]) || "UNKNOWN");
      }
    } catch {
      setErrorCode("UNKNOWN");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    setErrorCode(null);
    try {
      const cleanPhone = phone ? phone.replace(/[^\d+]/g, "").trim() : maskedPhone;
      const result = await cashOtpResendAction({
        booking_id: bookingId,
        phone: cleanPhone,
      });
      if (result?.ok) {
        setTimeLeft(initialExpiresIn);
        setResendCooldown(result.resendAvailableIn ?? 60);
        setOtp("");
      } else {
        setErrorCode((result?.error as keyof CashOtpDict["errors"]) || "UNKNOWN");
      }
    } catch {
      setErrorCode("UNKNOWN");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const errorMessage = errorCode ? dict.errors[errorCode] || dict.errors.UNKNOWN : null;
  const isExpired = timeLeft === 0;
  const rawDigits = phone ? phone.replace(/\D/g, "") : "";
  const normalizedPhone = rawDigits.startsWith("998") ? `+${rawDigits}` : `+998${rawDigits}`;
  const displayPhone =
    maskedPhone ||
    (rawDigits.length >= 9
      ? normalizedPhone.replace(/(\+998\d{2})\d{3}(\d{2})(\d{2})/, "$1 *** ** $3")
      : phone);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-2">{dict.title}</h2>
        <p className="text-sm text-slate-600 mb-6">
          {dict.description.replace("{phone}", "").trim()}{" "}
          <strong className="font-semibold">{displayPhone}</strong>
        </p>

        <div className="flex justify-center mb-4">
          <CodeSlots
            length={6}
            value={otp}
            onChange={(val) => {
              setOtp(val);
              setErrorCode(null);
            }}
            onComplete={(val) => {
              handleVerify(val);
            }}
            status={isSuccess ? "success" : errorCode ? "error" : "idle"}
            disabled={isLoading || isExpired || isSuccess}
            autoFocus
            slotSize={46}
            gap={8}
            accentColor="#2563eb"
            slotColor="#f8fafc"
            digitColor="#0f172a"
            dangerColor="#ef4444"
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600 font-medium text-center mt-2 mb-2">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between mt-4 mb-6">
          <span className="text-sm text-slate-500">{dict.timerLabel}</span>
          <span className={`text-sm tabular-nums font-semibold ${isExpired ? "text-red-500" : "text-slate-700"}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={isLoading || otp.length < 6 || isExpired || isSuccess}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSuccess ? "Tasdiqlandi!" : isLoading ? dict.verifying : dict.verifyButton}
          </button>
          
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading || resendCooldown > 0 || isSuccess}
            className="w-full py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {resendCooldown > 0
              ? `${dict.resendButton} (${formatTime(resendCooldown)})`
              : dict.resendButton}
          </button>
          
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {dict.cancelButton}
          </button>
        </div>
      </div>
    </div>
  );
}
