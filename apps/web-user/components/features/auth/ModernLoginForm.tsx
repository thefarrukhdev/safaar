"use client";

import React, { useState, useActionState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Hash } from "lucide-react";
import {
  loginAction,
  requestPasswordResetAction,
  resetPasswordAction,
  verifyPasswordResetCodeAction,
  type LoginState,
  type PasswordResetCodeState,
  type PasswordResetRequestState,
  type PasswordResetState,
} from "@/lib/auth/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "./AuthLayout";
import { config } from "@/lib/config";
import type { Locale } from "@/i18n/config";
import type { AuthDict } from "@/i18n/dictionaries";
import { AuthInput } from "./AuthInput";
import { useZodForm } from "@/hooks/use-zod-form";
import { z } from "zod";
import { ThinkingOrb } from "@/components/ui/thinking-orb";

const API_URL = config.apiUrl;

type LoginMode = "login" | "forgot-email" | "forgot-code" | "reset-password";

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

export default function ModernLoginForm({
  dict,
  next = "",
  socialError,
  locale = "uz"
}: {
  dict: AuthDict;
  next?: string;
  socialError?: string;
  locale?: Locale;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("login");
  const [direction, setDirection] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetChallengeId, setResetChallengeId] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [loginState, loginFormAction, loggingIn] = useActionState<LoginState, FormData>(loginAction, {});
  const [resetRequestState, requestResetFormAction, requestingReset] = useActionState<PasswordResetRequestState, FormData>(requestPasswordResetAction, { ok: false });
  const [resetCodeState, verifyResetCodeFormAction, verifyingResetCode] = useActionState<PasswordResetCodeState, FormData>(verifyPasswordResetCodeAction, { verified: false });
  const [resetPasswordState, resetPasswordFormAction, resettingPassword] = useActionState<PasswordResetState, FormData>(resetPasswordAction, { ok: false });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  
  const forgotEmailSchema = z.object({
    email: z.string().email(),
  });
  
  const forgotCodeSchema = z.object({
    code: z.string().min(6).max(6),
  });
  
  const resetPasswordSchema = z.object({
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  }).refine(data => data.password === data.confirmPassword, {
    message: dict.error || "Passwords don't match",
    path: ["confirmPassword"],
  });

  const loginForm = useZodForm({ schema: loginSchema, defaultValues: { email: "", password: "" } });
  const forgotEmailForm = useZodForm({ schema: forgotEmailSchema, defaultValues: { email: "" } });
  const forgotCodeForm = useZodForm({ schema: forgotCodeSchema, defaultValues: { code: "" } });
  const resetPasswordForm = useZodForm({ schema: resetPasswordSchema, defaultValues: { password: "", confirmPassword: "" } });

  const loginFormRef = useRef<HTMLFormElement>(null);
  const forgotEmailFormRef = useRef<HTMLFormElement>(null);
  const forgotCodeFormRef = useRef<HTMLFormElement>(null);
  const resetPasswordFormRef = useRef<HTMLFormElement>(null);

  const oauthQuery = new URLSearchParams({
    client_id: "safaar-web-user",
    redirect_uri: `${config.siteUrl}/api/auth/social-callback`,
    state: JSON.stringify({ next, locale }),
  }).toString();

  const handleRegisterClick = () => {
    router.push(`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  };

  const changeMode = (newMode: LoginMode, dir: number) => {
    setDirection(dir);
    setMode(newMode);
  };

  useEffect(() => {
    if (resetRequestState.ok) {
      setResetEmail(resetRequestState.email!);
      setResetChallengeId(resetRequestState.challengeId!);
      changeMode("forgot-code", 1);
    }
  }, [resetRequestState.ok]);

  useEffect(() => {
    if (resetCodeState.verified && resetCodeState.resetToken) {
      setResetToken(resetCodeState.resetToken);
      changeMode("reset-password", 1);
    }
  }, [resetCodeState.verified, resetCodeState.resetToken]);

  useEffect(() => {
    if (resetPasswordState.ok) {
      changeMode("login", -1);
    }
  }, [resetPasswordState.ok]);

  return (
    <AuthLayout locale={locale} dict={dict}>
      
      {mode !== "login" && (
        <button onClick={() => changeMode("login", -1)} className="absolute top-8 left-8 text-slate-500 hover:text-slate-900 transition-colors z-50">
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      <div className="relative min-h-[400px] flex flex-col justify-center overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          
          {/* LOGIN MODE */}
          {mode === "login" && (
            <motion.div
              key="login"
              custom={direction}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="w-full flex flex-col"
            >
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{dict.title || "Xush kelibsiz"}</h2>
                <p className="text-slate-500 text-sm">{dict.passwordLoginSubtitle || "Tizimga kirish uchun ma'lumotlaringizni kiriting."}</p>
              </div>

              <form ref={loginFormRef} onSubmit={loginForm.handleSubmit(() => { loginFormAction(new FormData(loginFormRef.current!)); })} className="space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="next" value={next} />
                
                {loginState.error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl mb-4">
                    {dict.invalidCredentials || "Noto'g'ri email yoki parol"}
                  </div>
                )}
                
                {socialError && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl mb-4">
                    {socialError}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <AuthInput
                    label={dict.email || "Elektron pochta"}
                    type="email"
                    icon={Mail}
                    placeholder="siz@misol.uz"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <span className="text-xs text-red-600">{loginForm.formState.errors.email.message as string}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-xs font-medium text-slate-500">{dict.password || "Parol"}</label>
                    <button type="button" onClick={() => changeMode("forgot-email", 1)} className="text-xs text-blue-600 hover:text-blue-700 transition-colors">
                      {dict.forgotPassword || "Parolni unutdingizmi?"}
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                      placeholder="••••••••"
                      {...loginForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <span className="text-xs text-red-600">{loginForm.formState.errors.password.message as string}</span>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loggingIn}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-slate-900 font-semibold rounded-xl py-3 mt-4 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loggingIn ? <ThinkingOrb size={16} state="base" /> : <>{dict.login || "Tizimga kirish"} <ArrowRight className="w-4 h-4" /></>}
                </motion.button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-200 relative z-10">
                <p className="text-center text-xs text-slate-500 mb-4">{dict.or || "Yoki orqali davom eting"}</p>
                <div className="flex gap-4">
                  <a
                    href={`${API_URL}/auth/google?${oauthQuery}`}
                    className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="text-sm font-medium text-slate-700">Google</span>
                  </a>
                </div>
              </div>

              <p className="mt-6 text-center text-sm font-medium text-slate-500">
                {dict.noAccount || "Hisobingiz yo'qmi?"}{" "}
                <button onClick={handleRegisterClick} className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  {dict.register || "Ro'yxatdan o'tish"}
                </button>
              </p>
            </motion.div>
          )}

          {/* FORGOT EMAIL MODE */}
          {mode === "forgot-email" && (
            <motion.form
              key="forgot-email"
              ref={forgotEmailFormRef}
              onSubmit={forgotEmailForm.handleSubmit(() => { requestResetFormAction(new FormData(forgotEmailFormRef.current!)); })}
              custom={direction}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="w-full flex flex-col space-y-4"
            >
              <div className="mb-4 text-center">
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{dict.forgotPasswordTitle || "Parolni unutdingizmi?"}</h2>
                <p className="text-slate-500 text-sm">{dict.forgotPasswordSubtitle || "Emailingizni kiriting, tiklash kodini yuboramiz."}</p>
              </div>

              {resetRequestState.error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl">
                  {dict.error || "Xatolik yuz berdi"}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <AuthInput
                  label={dict.email || "Email"}
                  type="email"
                  icon={Mail}
                  {...forgotEmailForm.register("email")}
                />
                {forgotEmailForm.formState.errors.email && (
                  <span className="text-xs text-red-600">{forgotEmailForm.formState.errors.email.message as string}</span>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={requestingReset}
                className="w-full bg-blue-600 hover:bg-blue-700 text-slate-900 font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {requestingReset ? <ThinkingOrb size={16} state="base" /> : <>{dict.sendCode || "Kodni yuborish"} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.form>
          )}

          {/* FORGOT CODE MODE */}
          {mode === "forgot-code" && (
            <motion.form
              key="forgot-code"
              ref={forgotCodeFormRef}
              onSubmit={forgotCodeForm.handleSubmit(() => { verifyResetCodeFormAction(new FormData(forgotCodeFormRef.current!)); })}
              custom={direction}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="w-full flex flex-col space-y-4"
            >
              <div className="mb-4 text-center">
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{dict.resetCodeTitle || "Tasdiqlash kodi"}</h2>
                <p className="text-slate-500 text-sm">{dict.resetCodeSubtitle || "Emailingizga kelgan 6 xonali kodni kiriting."}</p>
              </div>

              <input type="hidden" name="email" value={resetEmail} />
              <input type="hidden" name="challengeId" value={resetChallengeId} />

              {resetCodeState.error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl">
                  {dict.error || "Kod xato"}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <AuthInput
                  label={dict.code || "Kod"}
                  inputMode="numeric"
                  icon={Hash}
                  maxLength={6}
                  {...forgotCodeForm.register("code")}
                />
                {forgotCodeForm.formState.errors.code && (
                  <span className="text-xs text-red-600">{forgotCodeForm.formState.errors.code.message as string}</span>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={verifyingResetCode}
                className="w-full bg-blue-600 hover:bg-blue-700 text-slate-900 font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {verifyingResetCode ? <ThinkingOrb size={16} state="base" /> : <>{dict.verifyCode || "Tasdiqlash"} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.form>
          )}

          {/* RESET PASSWORD MODE */}
          {mode === "reset-password" && (
            <motion.form
              key="reset-password"
              ref={resetPasswordFormRef}
              onSubmit={resetPasswordForm.handleSubmit(() => { resetPasswordFormAction(new FormData(resetPasswordFormRef.current!)); })}
              custom={direction}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="w-full flex flex-col space-y-4"
            >
              <div className="mb-4 text-center">
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{dict.newPasswordTitle || "Yangi parol"}</h2>
                <p className="text-slate-500 text-sm">{dict.newPasswordSubtitle || "Yangi parolingizni kiriting."}</p>
              </div>

              <input type="hidden" name="email" value={resetEmail} />
              <input type="hidden" name="resetToken" value={resetToken} />

              {resetPasswordState.error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl">
                  {dict.error || "Xatolik"}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <AuthInput
                  label={dict.newPassword || "Yangi parol"}
                  type="password"
                  icon={Lock}
                  {...resetPasswordForm.register("password")}
                />
                {resetPasswordForm.formState.errors.password && (
                  <span className="text-xs text-red-600">{resetPasswordForm.formState.errors.password.message as string}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <AuthInput
                  label={dict.confirmPassword || "Parolni takrorlang"}
                  type="password"
                  icon={Lock}
                  {...resetPasswordForm.register("confirmPassword")}
                />
                {resetPasswordForm.formState.errors.confirmPassword && (
                  <span className="text-xs text-red-600">{resetPasswordForm.formState.errors.confirmPassword.message as string}</span>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={resettingPassword}
                className="w-full bg-blue-600 hover:bg-blue-700 text-slate-900 font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {resettingPassword ? <ThinkingOrb size={16} state="base" /> : <>{dict.saveNewPassword || "Saqlash"} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </AuthLayout>
  );
}
