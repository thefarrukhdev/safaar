"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../_hooks/use-body-scroll-lock";
import { useMounted } from "../../_hooks/use-mounted";
import { cn } from "../../_lib/utils/cn";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  contentClassName?: string;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
};

/**
 * Modern tactile modal dialog with a11y, focus trapping, safe backdrop click handling,
 * and flexible responsive viewport constraints.
 *
 * MUHIM: `document.body` ga portal qiladi — ajdod element'lardagi
 * `transform`/`filter`/`perspective` xususiyatlari fixed positioning'ni
 * buzmasligi uchun.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  contentClassName,
}: DialogProps) {
  const mounted = useMounted();
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const isBackdropClickRef = useRef(false);

  useBodyScrollLock(open);

  // Focus preservation and initial focus
  useEffect(() => {
    if (open) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        if (!modalRef.current) return;
        // Focus first interactive element or modal container
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = Array.from(focusable).find(
          (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
        );
        first?.focus();
      }, 30);
      return () => clearTimeout(timer);
    } else if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
      triggerElementRef.current.focus();
    }
  }, [open]);

  // Escape key and Focus Trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const modal = modalRef.current;
        if (!modal) return;
        const focusableElements = modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const focusable = Array.from(focusableElements).filter(
          (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    isBackdropClickRef.current = e.target === e.currentTarget;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (isBackdropClickRef.current && e.target === e.currentTarget) {
      onClose();
    }
    isBackdropClickRef.current = false;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
        aria-hidden
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          "soft-pop relative z-10 flex w-full max-h-[90dvh] min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-gradient)] shadow-2xl focus:outline-none",
          sizes[size],
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h2
              id="dialog-title"
              className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
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
            size="icon"
            onClick={onClose}
            aria-label="Yopish"
            className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-white shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        <div className={cn("flex-1 min-h-0 overflow-y-auto px-5 py-4 overscroll-contain", contentClassName)}>
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

export { ConfirmDialog } from "./confirm-dialog";
export type { ConfirmDialogProps } from "./confirm-dialog";

