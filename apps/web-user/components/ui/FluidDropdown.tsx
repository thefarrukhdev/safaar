"use client";

import React, { useRef, useState, useEffect, useId, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check } from "lucide-react";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/cn";

export interface FluidDropdownItem {
  label: string;
  value: string;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
}

export type FluidDropdownOption = string | FluidDropdownItem;

export interface FluidDropdownProps {
  items?: FluidDropdownOption[];
  options?: FluidDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  triggerLabel?: ReactNode;
  icon?: ReactNode;
  showChevron?: boolean;
  width?: string | number;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
  variant?: "light" | "dark" | "ghost";
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export const FluidDropdown: React.FC<FluidDropdownProps> = ({
  items,
  options,
  value,
  onChange,
  placeholder = "Tanlang",
  label,
  triggerLabel,
  icon,
  showChevron = true,
  width,
  className,
  buttonClassName,
  menuClassName,
  align = "left",
  disabled = false,
  variant = "light",
  size = "md",
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [highlight, setHighlight] = useState<HighlightRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const dropdownId = useId();

  // Normalize options to uniform { label, value, icon, description, disabled } objects
  const rawList = items ?? options ?? [];
  const normalizedItems: FluidDropdownItem[] = rawList.map((item) =>
    typeof item === "string" ? { label: item, value: item } : item
  );

  const selectedItem = normalizedItems.find((item) => item.value === value);

  useOnClickOutside(containerRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setHighlight((prev) => ({ ...prev, visible: false }));
    }
  });

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleItemHover = (el: HTMLElement) => {
    setHighlight({
      x: el.offsetLeft,
      y: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      visible: true,
    });
  };

  const handleMenuLeave = () => {
    setHighlight((prev) => ({ ...prev, visible: false }));
  };

  const handleSelect = (item: FluidDropdownItem) => {
    if (item.disabled) return;
    onChange(item.value);
    setIsOpen(false);
    setHighlight((prev) => ({ ...prev, visible: false }));
  };

  // Size styling tokens
  const sizeStyles = {
    sm: "h-9 px-3 text-xs rounded-full gap-2",
    md: "h-11 px-4 text-sm rounded-full gap-2.5",
    lg: "h-12 px-5 text-base rounded-full gap-3",
  }[size];

  // Variant styling tokens adhering to Safaar Design System
  const variantButtonStyles = {
    light: cn(
      "border border-slate-200 bg-white text-slate-900 shadow-none",
      "hover:border-slate-300 hover:bg-slate-50",
      "focus-visible:ring-blue-600",
      isOpen && "border-blue-600 bg-slate-50/50"
    ),
    dark: cn(
      "border border-white/10 bg-slate-900/90 text-white backdrop-blur-md shadow-none",
      "hover:border-white/20 hover:bg-slate-800/90",
      "focus-visible:ring-blue-400",
      isOpen && "border-blue-500/50 bg-slate-800"
    ),
    ghost: cn(
      "border border-transparent bg-transparent text-slate-900 shadow-none",
      "hover:bg-slate-100/80",
      "focus-visible:ring-blue-600",
      isOpen && "bg-slate-100"
    ),
  }[variant];

  const variantMenuStyles = {
    light: "border-slate-200 bg-white text-slate-900 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.05)]",
    dark: "border-slate-800 bg-slate-900/95 text-white backdrop-blur-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]",
    ghost: "border-slate-200 bg-white text-slate-900 shadow-xl",
  }[variant];

  const variantHighlightStyles = {
    light: "bg-slate-100",
    dark: "bg-white/[0.08]",
    ghost: "bg-slate-100",
  }[variant];

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left select-none", className)}
      style={width ? { width } : undefined}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={dropdownId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between transition-all duration-200 ease-out active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          "motion-reduce:transition-none motion-reduce:active:scale-100",
          sizeStyles,
          variantButtonStyles,
          disabled && "cursor-not-allowed opacity-40 hover:bg-transparent active:scale-100",
          buttonClassName
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {(icon || selectedItem?.icon) && (
            <span
              className={cn(
                "shrink-0 transition-colors opacity-80",
                variant === "dark" ? "text-white" : "text-current"
              )}
            >
              {selectedItem?.icon || icon}
            </span>
          )}

          <span className="flex min-w-0 flex-col text-left">
            {label && (
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider opacity-60",
                  variant === "dark" ? "text-white" : "text-current"
                )}
              >
                {label}
              </span>
            )}
            <span
              className={cn(
                "truncate font-medium",
                !selectedItem && !triggerLabel ? "opacity-60" : "opacity-100",
                variant === "dark" ? "text-white" : "text-current"
              )}
            >
              {triggerLabel ?? (selectedItem ? selectedItem.label : placeholder)}
            </span>
          </span>
        </span>

        {showChevron && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200 ease-out opacity-70",
              isOpen ? "rotate-180 opacity-100" : "",
              variant === "dark"
                ? "text-white"
                : isOpen
                ? "text-blue-600 group-data-[transparent=true]/header:text-white"
                : "text-current"
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            onMouseLeave={handleMenuLeave}
            role="listbox"
            aria-labelledby={dropdownId}
            className={cn(
              "absolute z-50 mt-1.5 min-w-full p-1.5 rounded-2xl border",
              align === "right" ? "right-0" : "left-0",
              variantMenuStyles,
              menuClassName
            )}
            style={{ width: "max-content", minWidth: "100%" }}
          >
            {/* Fluid Floating Highlight Pill */}
            {!prefersReducedMotion && (
              <motion.div
                aria-hidden="true"
                initial={false}
                animate={{
                  x: highlight.x,
                  y: highlight.y,
                  width: highlight.width,
                  height: highlight.height,
                  opacity: highlight.visible ? 1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 550,
                  damping: 38,
                  mass: 0.6,
                  opacity: { duration: 0.12 },
                }}
                className={cn("pointer-events-none absolute left-0 top-0 rounded-xl", variantHighlightStyles)}
              />
            )}

            {/* Empty state */}
            {normalizedItems.length === 0 && (
              <div
                className={cn(
                  "px-3 py-2 text-center text-xs",
                  variant === "dark" ? "text-white/40" : "text-slate-400"
                )}
              >
                Ma&apos;lumot yo&apos;q
              </div>
            )}

            {/* Menu Items */}
            <div className="relative flex flex-col gap-0.5">
              {normalizedItems.map((item) => {
                const isSelected = item.value === value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={item.disabled}
                    onMouseEnter={(e) => !item.disabled && handleItemHover(e.currentTarget)}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "relative z-10 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs font-medium tracking-tight",
                      "cursor-pointer outline-none select-none transition-colors duration-150",
                      variant === "dark"
                        ? "text-white/80 hover:text-white"
                        : "text-slate-700 hover:text-slate-900",
                      isSelected && (
                        variant === "dark"
                          ? "font-semibold text-white"
                          : "font-semibold text-blue-600"
                      ),
                      item.disabled && "cursor-not-allowed opacity-40 hover:text-inherit"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5 truncate">
                      {item.icon && (
                        <span
                          className={cn(
                            "shrink-0",
                            isSelected
                              ? (variant === "dark" ? "text-blue-400" : "text-blue-600")
                              : (variant === "dark" ? "text-white/50" : "text-slate-400")
                          )}
                        >
                          {item.icon}
                        </span>
                      )}
                      <span className="flex flex-col">
                        <span className="truncate">{item.label}</span>
                        {item.description && (
                          <span
                            className={cn(
                              "text-[10px] font-normal",
                              variant === "dark" ? "text-white/40" : "text-slate-500"
                            )}
                          >
                            {item.description}
                          </span>
                        )}
                      </span>
                    </span>

                    {isSelected && (
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 stroke-[2.5]",
                          variant === "dark" ? "text-blue-400" : "text-blue-600"
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FluidDropdown;
