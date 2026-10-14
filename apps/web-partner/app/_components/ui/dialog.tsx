"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
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
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

/**
 * Oddiy modal dialog.
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
}: DialogProps) {
  const mounted = useMounted();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "soft-pop relative z-10 flex w-full flex-col overflow-hidden rounded-card border border-[var(--border)] bg-[var(--panel-gradient)] shadow-2xl",
          sizes[size],
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4">
          <div className="flex flex-col gap-1">
            <h2
              id="dialog-title"
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
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3">
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

