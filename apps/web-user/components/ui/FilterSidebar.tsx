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
  title = "Filtrlar",
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
      <aside className="hidden w-full flex-col gap-5 rounded-xl border border-slate-900/[0.08] bg-white p-5 dark:border-white/[0.10] dark:bg-slate-900 lg:flex lg:sticky lg:top-24 lg:h-fit">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.08] pb-3.5 dark:border-white/[0.10]">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full px-2 py-1"
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
            className="w-full rounded-full bg-blue-600 h-12 px-6 flex items-center justify-center text-base font-medium text-white  transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none cursor-pointer"
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
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 transition-opacity"
            onClick={onClose}
          />

          {/* Drawer content sheet */}
          <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-xl border-t border-slate-900/[0.08] dark:border-white/[0.10] bg-white dark:bg-slate-900 shadow-float animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.2,0,0,1)]">
            {/* Drag Handle */}
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-900/[0.12] dark:bg-white/[0.16]" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-5 py-4 dark:border-white/[0.10]">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {title}
                </h2>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onReset}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full px-2 py-1"
                >
                  {resetLabel}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-900/[0.08] text-slate-900/60 hover:bg-slate-900/[0.05] hover:text-slate-900 dark:border-white/[0.10] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
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
            <div className="border-t border-slate-900/[0.08] bg-white px-5 py-4 dark:border-white/[0.10] dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  onApply();
                  onClose();
                }}
                className="w-full rounded-full bg-blue-600 h-12 px-6 flex items-center justify-center text-base font-medium text-white  transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none cursor-pointer"
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

