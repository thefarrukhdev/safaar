"use client";

import React, { useState, useEffect, useRef } from "react";
import { cashOtpVerifyAction, cashOtpResendAction } from "@/lib/services/booking/actions";

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
  bookingId: string;
  maskedPhone: string;
  initialExpiresIn?: number;
  dict: CashOtpDict;
  onSuccess: (bookingId: string) => void;
  onClose: () => void;
}

export function CashOtpModal({
  isOpen,
  bookingId,
  maskedPhone,
  initialExpiresIn = 180,
  dict,
  onSuccess,
  onClose,
}: CashOtpModalProps) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState(initialExpiresIn);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<keyof CashOtpDict["errors"] | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setOtp(Array(6).fill(""));
      setTimeLeft(initialExpiresIn);
      setResendCooldown(60);
      setErrorCode(null);
      setIsLoading(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, initialExpiresIn]);

  useEffect(() => {
    if (isOpen) {
      // Modal ochilganda birinchi inputga focus qaratish
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
    // Faqat raqamlarga ruxsat
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorCode(null); // Xatoni tozalash

    // Keyingi inputga o'tish
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    setErrorCode(null);

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setErrorCode("INCOMPLETE_CODE");
      return;
    }

    setIsLoading(true);
    setErrorCode(null);
    try {
      const result = await cashOtpVerifyAction({ booking_id: bookingId, otp_code: code });
      if (result?.ok) {
        onSuccess(bookingId);
      } else {
        setErrorCode((result?.error as keyof CashOtpDict["errors"]) || "UNKNOWN");
      }
    } catch (err) {
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
      const result = await cashOtpResendAction({ booking_id: bookingId });
      if (result?.ok) {
        setTimeLeft(initialExpiresIn);
        setResendCooldown(60);
        setOtp(Array(6).fill(""));
        inputRefs.current[0]?.focus();
      } else {
        setErrorCode((result?.error as keyof CashOtpDict["errors"]) || "UNKNOWN");
      }
    } catch (err) {
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

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-2">{dict.title}</h2>
        <p className="text-sm text-slate-600 mb-6">
          {dict.description} <strong className="font-semibold">{maskedPhone}</strong>
        </p>

        <div className="flex justify-between gap-2 mb-4" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              placeholder={dict.inputPlaceholder}
              className={`w-11 h-14 text-center text-2xl font-bold font-mono border-2 rounded-xl transition-colors focus:outline-none ${
                errorCode
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-200 focus:border-blue-500"
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
          ))}
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
            onClick={handleVerify}
            disabled={isLoading || otp.join("").length < 6 || isExpired}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? dict.verifying : dict.verifyButton}
          </button>
          
          <button
            onClick={handleResend}
            disabled={isLoading || resendCooldown > 0}
            className="w-full py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {resendCooldown > 0
              ? `${dict.resendButton} (${formatTime(resendCooldown)})`
              : dict.resendButton}
          </button>
          
          <button
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
