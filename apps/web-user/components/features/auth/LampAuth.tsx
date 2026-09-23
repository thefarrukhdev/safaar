"use client";

import React, { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Loader2
} from "lucide-react";

// ==========================================
// Reusable UI Components (DRY & SOLID)
// ==========================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ElementType;
  rightElement?: React.ReactNode;
}

const AuthInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, icon: Icon, rightElement, ...props }, ref) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-400 pl-1">{label}</label>
      <div className="relative group">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
        <input
          ref={ref}
          className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  )
);
AuthInput.displayName = "AuthInput";

import { loginAction, type LoginState } from "@/lib/auth/actions";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ... skipping to Main Component ...
export default function LampAuth({
  dict,
  initialIsLogin = true,
  next = "",
  socialError,
  locale = "uz"
}: {
  dict?: any;
  initialIsLogin?: boolean;
  next?: string;
  socialError?: string;
  locale?: string;
}) {
  const router = useRouter();
  const [isOn, setIsOn] = useState(false);
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const toggleLight = () => setIsOn(!isOn);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Real Backend Action
  const [loginState, loginFormAction, loggingIn] = useActionState<LoginState, FormData>(loginAction, {});

  // Handle Register click
  const handleTabClick = (tab: string) => {
    if (tab === "Register") {
      router.push(`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    } else {
      setIsLogin(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col md:flex-row items-center justify-center p-4 overflow-hidden relative">
      
      {/* Background Ambient Glow when ON */}
      <AnimatePresence>
        {isOn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.08) 0%, transparent 70%)"
            }}
          />
        )}
      </AnimatePresence>

      {/* LEFT COLUMN: THE LAMP */}
      <div className="relative w-full md:w-1/2 h-[400px] md:h-[600px] flex items-center justify-center flex-shrink-0 z-20">
        
        {/* Tooltip */}
        <AnimatePresence>
          {!isOn && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-[20%] left-1/2 -translate-x-1/2 text-zinc-500 text-xs font-medium tracking-wide bg-zinc-900/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-zinc-800/50 shadow-lg pointer-events-none"
            >
              Pull to illuminate
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex flex-col items-center">
          {/* Lamp Shade */}
          <div className="relative z-10 w-48 h-32 bg-zinc-900 rounded-t-xl rounded-b-sm border border-zinc-800 shadow-2xl flex items-end justify-center overflow-hidden">
            {/* Inner glow of the shade */}
            <motion.div 
              animate={{ opacity: isOn ? 1 : 0.05 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 w-full h-12 bg-amber-500/20 blur-xl"
            />
          </div>

          {/* Bulb / Light Source */}
          <motion.div
            animate={{
              backgroundColor: isOn ? "#fbbf24" : "#27272a",
              boxShadow: isOn 
                ? "0 0 40px 10px rgba(251,191,36,0.6), 0 0 100px 20px rgba(245,158,11,0.4)" 
                : "0 0 0px 0px rgba(251,191,36,0)",
            }}
            transition={{ duration: 0.1 }}
            className="w-12 h-6 rounded-b-full relative -mt-1 z-0"
          />

          {/* Lamp Stand */}
          <div className="w-3 h-80 bg-zinc-900 border-x border-zinc-800 mt-0 z-[-1]" />
          <div className="w-24 h-4 bg-zinc-900 rounded-t-lg border border-zinc-800 z-[-1]" />

          {/* The Pull String */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 40 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y > 20) toggleLight();
            }}
            onClick={toggleLight}
            className="absolute top-[140px] right-[40px] w-1 h-32 flex flex-col items-center cursor-grab active:cursor-grabbing group"
          >
            {/* String line */}
            <div className="w-[2px] h-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors" />
            {/* Pull Knob */}
            <div className="w-4 h-6 bg-zinc-600 rounded-full border-2 border-zinc-500 shadow-lg group-hover:bg-zinc-400 transition-colors" />
          </motion.div>

          {/* Volumetric Light Cone */}
          <AnimatePresence>
            {isOn && (
              <motion.div
                initial={{ opacity: 0, scaleY: 0.8 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute top-[140px] w-[600px] h-[800px] origin-top pointer-events-none mix-blend-screen"
                style={{
                  background: "linear-gradient(to bottom, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.02) 60%, transparent 100%)",
                  clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0% 100%)"
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT COLUMN: AUTH CARD */}
      <div className="w-full md:w-1/2 flex items-center justify-center z-30 p-4">
        <motion.div
          animate={{
            opacity: isOn ? 1 : 0.3,
            filter: isOn ? "blur(0px)" : "blur(4px)",
            y: isOn ? 0 : 10,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden ${
            !isOn && "pointer-events-none select-none"
          }`}
        >
          {/* Subtle top glare */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent" />

          {/* Tab Switcher */}
          <div className="flex bg-zinc-950/50 p-1 rounded-xl mb-8 border border-zinc-800/50 relative z-10">
            {["Login", "Register"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all relative ${
                  (isLogin && tab === "Login") || (!isLogin && tab === "Register")
                    ? "text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab}
                {((isLogin && tab === "Login") || (!isLogin && tab === "Register")) && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-zinc-800/80 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="mb-8 relative z-10">
            <h2 className="text-2xl font-bold text-white mb-1">
              {isLogin ? "Xush kelibsiz" : "Ro'yxatdan o'tish"}
            </h2>
            <p className="text-zinc-400 text-sm">
              {isLogin
                ? "Tizimga kirish uchun ma'lumotlaringizni kiriting."
                : "Davom etish uchun yangi hisob yarating."}
            </p>
          </div>

          <form action={loginFormAction} className="space-y-4 relative z-10">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            
            {loginState.error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl mb-4">
                {dict.invalidCredentials || "Xatolik yuz berdi"}
              </div>
            )}
            
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <AuthInput
                    label="To'liq ism"
                    name="name"
                    type="text"
                    icon={User}
                    placeholder="Eshmat Toshmatov"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AuthInput
              label="Elektron pochta"
              name="email"
              type="email"
              icon={Mail}
              placeholder="siz@misol.uz"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <div className="space-y-1">
              <div className="flex justify-between items-center pl-1">
                <label className="text-xs font-medium text-zinc-400">Parol</label>
                {isLogin && (
                  <a href="#" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                    Parolni unutdingizmi?
                  </a>
                )}
              </div>
              <AuthInput
                label=""
                name="password"
                type={showPassword ? "text" : "password"}
                icon={Lock}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                    aria-label="Parolni ko'rsatish"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            {/* SAFAAR BLUE PRIMARY BUTTON */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loggingIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 mt-4 flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loggingIn ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Tizimga kirish" : "Davom etish"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-800 relative z-10">
            <p className="text-center text-xs text-zinc-500 mb-4">Yoki orqali davom eting</p>
            <div className="flex gap-4">
              <button
                type="button"
                className="flex-1 bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors"
              >
                {/* Custom Google SVG Icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-sm font-medium text-zinc-300">Google</span>
              </button>
              <button
                type="button"
                className="flex-1 bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors"
              >
                {/* Custom GitHub SVG Icon */}
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                <span className="text-sm font-medium text-zinc-300">GitHub</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
