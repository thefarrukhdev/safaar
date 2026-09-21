"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  // Oyna ochilganda orqa fon skroll bo'lishini to'xtatamiz
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // ESC tugmasi orqali yopish
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Qoramtir Fon (Backdrop) */}
      <div
        className="fixed inset-0 bg-slate-900/50 transition-opacity dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Asosiy Dialog Oynasi */}
      <div
        className={`relative flex w-full flex-col ${maxWidth} transform rounded-xl border border-slate-900/[0.08] bg-white shadow-float transition-all duration-200 animate-in fade-in zoom-in-95 dark:border-white/[0.10] dark:bg-slate-900`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Sarlavhasi (Header) */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-6 py-4 dark:border-white/[0.10]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-full text-slate-900/70 transition-colors hover:bg-slate-900/[0.08] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-white/70 dark:hover:bg-white/[0.12] dark:hover:text-white"
              aria-label="Oynani yopish"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

        {/* Modal Ichki Qismi (Content) */}
        <div className="max-h-[80vh] overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
