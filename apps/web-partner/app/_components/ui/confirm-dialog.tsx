"use client";

import {
  AlertTriangle,
  HelpCircle,
  X,
} from "lucide-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../_hooks/use-body-scroll-lock";
import { useMounted } from "../../_hooks/use-mounted";
import { cn } from "../../_lib/utils/cn";
import { Button } from "./button";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** Muqobil nomlar / moslik uchun */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
}

type ConfirmContextType = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm faqat ConfirmProvider ichida ishlatilishi mumkin");
  }
  return context;
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<DialogState | null>(null);
  const queueRef = useRef<DialogState[]>([]);
  const activeDialogRef = useRef<DialogState | null>(null);

  useEffect(() => {
    activeDialogRef.current = activeDialog;
  }, [activeDialog]);

  const processNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setActiveDialog(next);
    } else {
      setActiveDialog(null);
    }
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const item: DialogState = { ...options, resolve };
      if (!activeDialogRef.current) {
        setActiveDialog(item);
      } else {
        queueRef.current.push(item);
      }
    });
  }, []);

  const handleClose = useCallback(
    (result: boolean) => {
      const current = activeDialogRef.current;
      if (current) {
        current.resolve(result);
        processNext();
      }
    },
    [processNext],
  );

  // Unmount bo'lganda barcha ochiq va navbatdagi dialoglarni bekor qilish (memory leak va hanging promise oldini olish)
  useEffect(() => {
    return () => {
      if (activeDialogRef.current) {
        activeDialogRef.current.resolve(false);
      }
      for (const item of queueRef.current) {
        item.resolve(false);
      }
      queueRef.current = [];
    };
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {activeDialog && (
        <ConfirmDialogView
          open={true}
          options={activeDialog}
          onClose={() => handleClose(false)}
          onConfirm={() => handleClose(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  tone?: "danger" | "primary";
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  confirmLabel,
  cancelLabel,
  destructive,
  tone,
  icon,
  size,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <ConfirmDialogView
      open={open}
      options={{
        title,
        description,
        confirmText,
        cancelText,
        confirmLabel,
        cancelLabel,
        destructive,
        tone,
        icon,
        size,
      }}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

function ConfirmDialogView({
  open,
  options,
  onClose,
  onConfirm,
}: {
  open: boolean;
  options: ConfirmOptions;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const mounted = useMounted();
  useBodyScrollLock(open);

  const titleId = useId();
  const descId = useId();

  const isDestructive =
    options.destructive ?? (options.tone === "danger");

  const confirmBtnText =
    options.confirmText ||
    options.confirmLabel ||
    (isDestructive ? "O'chirish" : "Tasdiqlash");
  const cancelBtnText =
    options.cancelText || options.cancelLabel || "Bekor qilish";

  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Saqlangan oldingi fokus va avtofokus
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Destructive bo'lsa xavfsizlik uchun Cancel tugmasiga fokus beriladi,
    // aks holda Confirm tugmasiga fokuslanadi.
    const timer = setTimeout(() => {
      if (isDestructive && cancelBtnRef.current) {
        cancelBtnRef.current.focus();
      } else if (confirmBtnRef.current) {
        confirmBtnRef.current.focus();
      }
    }, 20);

    return () => {
      clearTimeout(timer);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [isDestructive]);

  // Escape va Focus Trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={options.description ? descId : undefined}
    >
      {/* Apple-style ultra-clean backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Dialog Card */}
      <div
        ref={modalRef}
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800",
          "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl transition-all duration-200",
          "p-6 soft-pop flex flex-col gap-5",
          sizeClasses[options.size ?? "md"],
        )}
      >
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              isDestructive
                ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 ring-1 ring-rose-500/20"
                : "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 ring-1 ring-brand-500/20",
            )}
            aria-hidden="true"
          >
            {options.icon ? (
              options.icon
            ) : isDestructive ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <HelpCircle className="h-5 w-5" />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1 min-w-0 pt-0.5">
            <h3
              id={titleId}
              className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              {options.title}
            </h3>
            {options.description && (
              <div
                id={descId}
                className="text-sm leading-relaxed text-slate-600 dark:text-slate-400"
              >
                {options.description}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Yopish"
            className="h-8 w-8 min-h-0 min-w-0 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Buttons: 44px minimum touch targets for WCAG a11y */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            {cancelBtnText}
          </Button>
          <Button
            ref={confirmBtnRef}
            type="button"
            variant={isDestructive ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
          >
            {confirmBtnText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
