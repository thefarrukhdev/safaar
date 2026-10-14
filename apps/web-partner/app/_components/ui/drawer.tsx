"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../_hooks/use-body-scroll-lock";
import { useMounted } from "../../_hooks/use-mounted";
import { cn } from "../../_lib/utils/cn";
import { Button } from "./button";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
}

const sizes = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

/**
 * O'ngdan chiquvchi slide-over drawer. Modern PMS/CMS'larda ishlatiladigan
 * pattern (Airbnb Host, Vercel, Linear...).
 *
 * Portal orqali `document.body`ga renderlanadi — ajdodlardagi `transform`
 * fixed positioning'ni buzmasin.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  size = "lg",
  footer,
}: DrawerProps) {
  const mounted = useMounted();
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useBodyScrollLock(open);

  // Focus management: save active element before open, restore on close
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      triggerElementRef.current = (document.activeElement as HTMLElement | null) ?? null;
      const frame = requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
        triggerElementRef.current.focus();
      }
      triggerElementRef.current = null;
    }
  }, [open]);

  // Clean up focus on unmount if drawer was open
  useEffect(() => {
    return () => {
      if (wasOpenRef.current && triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
        triggerElementRef.current.focus();
      }
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100]",
        !open && "pointer-events-none",
      )}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="drawer-title"
        inert={!open ? true : undefined}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--panel-gradient)] shadow-2xl transition-transform duration-300 ease-out outline-none",
          sizes[size],
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2
              id="drawer-title"
              className="text-lg font-semibold tracking-tight"
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm text-[var(--muted-foreground)]">
                {description}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Yopish"
            className="h-8 w-8 min-h-0 min-w-0 p-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-6 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
