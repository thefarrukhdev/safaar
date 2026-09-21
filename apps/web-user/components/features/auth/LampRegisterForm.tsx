"use client";

import React, { useState, useActionState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Hash, User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import { 
  requestOtpAction, 
  verifyOtpAction, 
  completeProfileAction,
  type OtpState,
  type VerifyState,
  type CompleteProfileState,
} from "@/lib/auth/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LampAuthLayout } from "@/app/[lang]/(auth)/_components/LampAuthLayout";
import type { Locale } from "@/i18n/config";
import type { AuthDict } from "@/i18n/dictionaries";

function passwordStrength(pw: string): { label: string; level: number; color: string } {
  if (!pw) return { label: "", level: 0, color: "bg-zinc-800" };
  let level = 0;
  if (pw.length >= 8) level += 1;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) level += 1;
  if (/[^A-Za-z0-9]/.test(pw)) level += 1;
  if (level === 1) return { label: "Zaif", level: 1, color: "bg-red-500" };
  if (level === 2) return { label: "O'rtacha", level: 2, color: "bg-amber-500" };
  if (level === 3) return { label: "Kuchli", level: 3, color: "bg-green-500" };
  return { label: "Juda zaif", level: 0, color: "bg-red-500" };
}

import { AuthInput } from "./AuthInput";

const formVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 100 : -100,
    opacity: 0
  })
};

export default function LampRegisterForm({
  dict,
  next = "",
  locale = "uz"
}: {
  dict: AuthDict;
  next?: string;
  locale?: Locale;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  const [otpState, requestAction, sending] = useActionState<OtpState, FormData>(requestOtpAction, { ok: false });
  const [verifyState, verifyAction, verifying] = useActionState<VerifyState, FormData>(verifyOtpAction, {} as VerifyState);
  const [completeState, completeAction, completing] = useActionState<CompleteProfileState, FormData>(completeProfileAction, {} as CompleteProfileState);

  const strength = passwordStrength(password);

  useEffect(() => {
    if (otpState.ok) {
      setDirection(1);
      setStep(2);
    }
  }, [otpState.ok]);

  useEffect(() => {
    if (verifyState.needsProfile) {
      setDirection(1);
      setStep(3);
    }
  }, [verifyState.needsProfile]);

  const goBack = () => {
    setDirection(-1);
    setStep(step - 1);
  };

  const handleLoginClick = () => {
    router.push(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  };

  return (
    <LampAuthLayout locale={locale}>
      
      {step > 1 && (
        <button onClick={goBack} className="absolute top-8 left-8 text-zinc-500 hover:text-white transition-colors z-50">
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      <div className="mb-8 relative z-10 text-center">
        <h2 className="text-2xl font-bold text-white mb-1">
          {step === 3 ? dict.completeProfileTitle || "Profilni yakunlash" : dict.registerTitle || "Ro'yxatdan o'tish"}
        </h2>
        <p className="text-zinc-400 text-sm">
          {step === 3 ? dict.completeProfileSubtitle : dict.registerSubtitle || "Davom etish uchun yangi hisob yarating."}
        </p>
      </div>

      <div className="relative min-h-[300px] flex flex-col justify-center overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          
          {/* STEP 1: PHONE */}
          {step === 1 && (
            <motion.form 
              key="step1"
              action={requestAction}
              custom={direction}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="space-y-4 w-full"
            >
              <input type="hidden" name="locale" value={locale} />
              
              {otpState.error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl">
                  {otpState.error === "PHONE_REQUIRED" ? dict.phoneRequired : dict.error}
                </div>
              )}

              <AuthInput
                label={dict.phone || "Telefon raqam"}
                name="phone"
                type="tel"
                icon={Phone}
                placeholder="+998 90 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 mt-4 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{dict.sendCode || "Kodni yuborish"} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.form>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <motion.form 
              key="step2"
              action={verifyAction}
              custom={direction}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="space-y-4 w-full"
            >
              <input type="hidden" name="phone" value={phone} />
              <input type="hidden" name="locale" value={locale} />
              
              {verifyState.error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl">
                  {verifyState.error === "OTP_INVALID" ? dict.codeInvalid : dict.error}
                </div>
              )}

              {otpState.devCode && (
                <div className="bg-green-500/10 border border-green-500/50 text-green-500 text-sm p-3 rounded-xl mb-4 text-center font-mono">
                  {dict.devCode}: {otpState.devCode}
                </div>
              )}

              <AuthInput
                label={dict.code || "Tasdiqlash kodi"}
                name="code"
                inputMode="numeric"
                icon={Hash}
                placeholder="••••••"
                maxLength={6}
                required
              />

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={verifying}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 mt-4 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{dict.verifyCode || "Tasdiqlash"} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.form>
          )}

          {/* STEP 3: PROFILE */}
          {step === 3 && (
            <motion.form 
              key="step3"
              action={completeAction}
              custom={direction}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="space-y-3 w-full"
            >
              <input type="hidden" name="phone" value={phone} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="next" value={next} />
              
              {completeState.error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl">
                  {dict.error}
                </div>
              )}

              <AuthInput
                label={dict.firstName || "Ism"}
                name="firstName"
                type="text"
                icon={User}
                required
              />

              <AuthInput
                label={dict.email || "Email"}
                name="email"
                type="email"
                icon={Mail}
                required
              />

              <div className="space-y-1">
                <AuthInput
                  label={dict.password || "Parol"}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  rightElement={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-zinc-500 hover:text-zinc-300 p-1">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                
                {password && (
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : "bg-zinc-800"}`} />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-zinc-400">{strength.label}</p>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 text-sm mt-4">
                <input type="checkbox" name="agreeTerms" required className="mt-1 bg-zinc-900 border-zinc-700 rounded text-blue-600 focus:ring-blue-500/50 focus:ring-offset-zinc-900" />
                <span className="text-zinc-400 text-xs">
                  Men <Link href={`/${locale}/terms`} target="_blank" className="text-blue-500 hover:underline">Ommaviy Oferta (Foydalanish shartlari)</Link> bilan tanishib chiqdim va ularga roziman.
                </span>
              </label>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={completing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 mt-4 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {completing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{dict.verifyAndRegister || "Tugatish"} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {step === 1 && (
        <p className="mt-6 text-center text-sm font-medium text-zinc-400 relative z-10">
          {dict.hasAccount || "Hisobingiz bormi?"}{" "}
          <button
            onClick={handleLoginClick}
            className="font-bold text-blue-500 hover:text-blue-400 transition-colors"
          >
            {dict.login || "Tizimga kirish"}
          </button>
        </p>
      )}

    </LampAuthLayout>
  );
}
