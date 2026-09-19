"use client";

import React, { useEffect } from "react";
import { Filter, X } from "lucide-react";

export interface FilterSidebarProps {
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  applyLabel?: string;
  resetLabel?: string;
  children: React.ReactNode;
}

export function FilterSidebar({
  title = "FILTRLAR",
  isOpen,
  onClose,
  onApply,
  onReset,
  applyLabel = "Natijalarni ko'rsatish",
  resetLabel = "Tozalash",
  children,
}: FilterSidebarProps) {
  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Keyboard escape listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-full flex-col gap-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900/90 lg:flex lg:sticky lg:top-24 lg:h-fit">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-extrabold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer transition-colors"
          >
            {resetLabel}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col gap-4">{children}</div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.99] cursor-pointer"
          >
            {applyLabel}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer (Bottom Sheet / Modal overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />

          {/* Drawer content sheet */}
          <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-300">
            {/* Drag Handle */}
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {title}
                </h2>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400"
                >
                  {resetLabel}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-4">{children}</div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => {
                  onApply();
                  onClose();
                }}
                className="w-full rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 cursor-pointer"
              >
                {applyLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

