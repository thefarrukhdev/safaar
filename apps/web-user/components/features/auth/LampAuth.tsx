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

export default function LampAuth() {
  const [isOn, setIsOn] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const toggleLight = () => {
    if (!isOn) {
      // Simulate click sound or haptic feedback if desired
      setIsOn(true);
    } else {
      setIsOn(false);
    }
  };

  const handleDragEnd = (e: any, info: any) => {
    if (info.offset.y > 20) {
      toggleLight();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col md:flex-row relative overflow-hidden font-sans text-zinc-100 selection:bg-amber-500/30">
      
      {/* Global Ambient Lighting from Lamp */}
      <motion.div
        initial={false}
        animate={{ opacity: isOn ? 1 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 25% 40%, rgba(245, 158, 11, 0.08) 0%, transparent 60%)",
        }}
      />

      {/* LEFT COLUMN: The Lamp */}
      <div className="w-full md:w-1/2 flex items-end justify-center relative z-10 h-[40vh] md:h-screen shrink-0 pb-0">
        <div className="relative flex flex-col items-center justify-end h-full">
          
          {/* Lamp Core (Shade + Light + String) */}
          <div className="absolute top-[10vh] md:top-[25vh] z-20 flex flex-col items-center">
            
            {/* Vivid Warm Light Cone */}
            <AnimatePresence>
              {isOn && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0.1, 1, 0.8, 1], // Ignition micro-flicker
                    scale: [0.98, 1.02, 0.99, 1] 
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="absolute top-full w-[250vw] md:w-[150vw] h-[100vh] origin-top pointer-events-none mix-blend-screen"
                  style={{
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "linear-gradient(to bottom, rgba(251, 191, 36, 0.45) 0%, rgba(245, 158, 11, 0.15) 40%, transparent 100%)",
                    clipPath: "polygon(35% 0, 65% 0, 100% 100%, 0 100%)",
                    filter: "blur(30px)",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Lamp Shade */}
            <div
              className="w-48 md:w-64 h-28 md:h-36 bg-zinc-900 relative z-10 border-b-2 border-zinc-950 shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
              style={{ clipPath: "polygon(30% 0, 70% 0, 100% 100%, 0 100%)" }}
            >
              {/* Inner Bulb Glow */}
              <motion.div 
                initial={false}
                animate={{ opacity: isOn ? 1 : 0 }}
                className="absolute bottom-0 left-0 right-0 h-12 bg-amber-400 blur-xl mix-blend-screen" 
              />
              <motion.div 
                initial={false}
                animate={{ opacity: isOn ? 1 : 0 }}
                className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-16 h-8 bg-white rounded-full blur-md opacity-80 mix-blend-screen" 
              />
            </div>

            {/* Pull String (Physics-driven) */}
            <motion.div
              className="relative flex flex-col items-center cursor-grab active:cursor-grabbing z-30"
              drag="y"
              dragConstraints={{ top: 0, bottom: 60 }}
              dragElastic={0.4}
              onDragEnd={handleDragEnd}
              whileTap={{ cursor: "grabbing" }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 12 }}
            >
              {/* The string beads */}
              <div 
                className="w-[2px] h-20 md:h-28 bg-gradient-to-b from-zinc-800 to-zinc-600" 
                style={{ 
                  backgroundImage: "repeating-linear-gradient(to bottom, #52525b, #52525b 2px, transparent 2px, transparent 4px)" 
                }} 
              />
              {/* The pull knob */}
              <div className="w-3 h-5 md:w-4 md:h-7 rounded-full bg-gradient-to-b from-amber-600 to-amber-800 shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-amber-500/40 relative">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-[1px] w-1 h-full mx-auto" />
              </div>

              {/* Tooltip */}
              <AnimatePresence>
                {!isOn && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 5 }}
                    exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                    transition={{ 
                      y: { repeat: Infinity, repeatType: "reverse", duration: 1.5, ease: "easeInOut" },
                      opacity: { duration: 0.4 }
                    }}
                    className="absolute top-full mt-6 w-48 text-center text-xs text-zinc-300 bg-zinc-800/90 border border-zinc-700 p-2.5 rounded-lg shadow-2xl backdrop-blur-md pointer-events-none"
                  >
                    Pull the string to turn on the light
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-800 border-l border-t border-zinc-700 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Lamp Stand */}
          <div className="w-2 md:w-3 h-[60vh] md:h-[65vh] bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-950 shadow-2xl relative z-0" />
          
          {/* Lamp Base */}
          <div className="w-40 md:w-56 h-4 md:h-6 bg-gradient-to-t from-zinc-950 to-zinc-800 rounded-t-3xl shadow-2xl z-0 border-t border-zinc-700/50" />
        </div>
      </div>

      {/* RIGHT COLUMN: Auth Card */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 z-20 relative h-[60vh] md:h-screen">
        <motion.div
          initial={false}
          animate={{
            opacity: isOn ? 1 : 0.15,
            filter: isOn ? "blur(0px)" : "blur(6px)",
            pointerEvents: isOn ? "auto" : "none",
            y: isOn ? 0 : 30,
            scale: isOn ? 1 : 0.96,
          }}
          transition={{ duration: 0.6, delay: isOn ? 0.1 : 0, ease: "easeOut" }}
          className="w-full max-w-md bg-zinc-900/70 backdrop-blur-xl border border-zinc-800 rounded-[2rem] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          {/* Subtle inner highlight when ON */}
          {isOn && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[50px] rounded-full pointer-events-none" 
            />
          )}

          {/* Tab Switcher */}
          <div className="flex bg-zinc-950/50 p-1 rounded-xl mb-8 relative z-10 border border-zinc-800/50">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 relative ${
                isLogin ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sign In
              {isLogin && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-zinc-800 rounded-lg -z-10 shadow-sm border border-zinc-700"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 relative ${
                !isLogin ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Create Account
              {!isLogin && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-zinc-800 rounded-lg -z-10 shadow-sm border border-zinc-700"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
              {isLogin ? "Welcome back" : "Get started"}
            </h2>
            <p className="text-zinc-400 text-sm">
              {isLogin
                ? "Enter your details to access your account."
                : "Create a new account to continue."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-1"
                >
                  <label className="text-xs font-medium text-zinc-400 pl-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required={!isLogin}
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all shadow-inner"
                      placeholder="John Doe"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400 pl-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all shadow-inner"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center pl-1">
                <label className="text-xs font-medium text-zinc-400">Password</label>
                {isLogin && (
                  <a href="#" className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all shadow-inner"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold rounded-xl py-3 mt-4 flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-800 relative z-10">
            <p className="text-center text-xs text-zinc-500 mb-4">Or continue with</p>
            <div className="flex gap-4">
              <button
                type="button"
                className="flex-1 bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors"
              >
                {/* Custom Google SVG Icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="text-sm font-medium text-zinc-300">Google</span>
              </button>
              <button
                type="button"
                className="flex-1 bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors"
              >
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
