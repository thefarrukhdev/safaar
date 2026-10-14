"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "../../_lib/utils/cn";

/**
 * Tablarni Next.js URL query params bilan sinxronizatsiya qiluvchi ergonomik hook.
 */
export function useTabsUrlSync(paramName = "tab", defaultTab = "") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTab = searchParams?.get(paramName) ?? defaultTab;

  const setTab = useCallback(
    (nextTab: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (nextTab === defaultTab || !nextTab) {
        params.delete(paramName);
      } else {
        params.set(paramName, nextTab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, paramName, defaultTab],
  );

  return [currentTab, setTab] as const;
}

type TabsVariant = "segmented" | "underline" | "pills";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: "horizontal" | "vertical";
  variant: TabsVariant;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound komponentlari faqat <Tabs> ichida ishlatilishi kerak");
  }
  return context;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  variant?: TabsVariant;
  children: ReactNode;
}

/**
 * Klaviatura boshqaruvi (Arrow keys, Home, End) va a11y standartlariga mos
 * unifikatsiyalangan Tabs konteyneri.
 */
export function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  orientation = "horizontal",
  variant = "segmented",
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;
  const baseId = useId();

  const handleValueChange = useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsContext.Provider
      value={{
        value: activeValue,
        onValueChange: handleValueChange,
        orientation,
        variant,
        baseId,
      }}
    >
      <div
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-row gap-6" : "flex-col gap-4",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Tab tugmalari to'plami. Klaviatura orqali (ArrowLeft/ArrowRight, ArrowUp/ArrowDown, Home, End)
 * tablarni boshqaradi.
 */
export function TabsList({ className, children, ...props }: TabsListProps) {
  const { orientation, variant } = useTabsContext();
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;

    const triggers = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    const currentIndex = triggers.findIndex(
      (el) => el === document.activeElement,
    );
    if (currentIndex === -1) return;

    let targetIndex = -1;

    if (orientation === "horizontal") {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        targetIndex = (currentIndex + 1) % triggers.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        targetIndex =
          (currentIndex - 1 + triggers.length) % triggers.length;
      }
    } else {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        targetIndex = (currentIndex + 1) % triggers.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        targetIndex =
          (currentIndex - 1 + triggers.length) % triggers.length;
      }
    }

    if (e.key === "Home") {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      targetIndex = triggers.length - 1;
    }

    if (targetIndex >= 0 && triggers[targetIndex]) {
      const targetTrigger = triggers[targetIndex];
      targetTrigger.focus();
      targetTrigger.click();
    }
  };

  const variantStyles = {
    segmented: cn(
      "rounded-xl bg-slate-100 p-1 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800",
      orientation === "vertical" ? "flex flex-col" : "inline-flex items-center",
    ),
    underline: cn(
      orientation === "vertical"
        ? "flex flex-col gap-1 border-r border-slate-200 dark:border-slate-800 pr-2"
        : "inline-flex items-center border-b border-slate-200 dark:border-slate-800 gap-6",
    ),
    pills: cn(
      "gap-1.5 p-1 rounded-xl bg-transparent",
      orientation === "vertical" ? "flex flex-col" : "inline-flex items-center",
    ),
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(
        "no-scrollbar overflow-x-auto",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
}

/**
 * Yakka tab tugmasi. Faol bo'lganda Linear/Apple uslubidagi silliq vizual effektga ega.
 */
export function TabsTrigger({
  value: triggerValue,
  disabled,
  className,
  children,
  onClick,
  ...props
}: TabsTriggerProps) {
  const { value, onValueChange, variant, baseId } = useTabsContext();
  const isSelected = value === triggerValue;
  const triggerId = `${baseId}-trigger-${triggerValue}`;
  const contentId = `${baseId}-content-${triggerValue}`;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      onValueChange(triggerValue);
    }
  };

  const variantClasses = {
    segmented: cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 min-h-[44px] sm:min-h-[36px]",
      "text-xs sm:text-sm font-medium transition-all duration-200 ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
      "disabled:pointer-events-none disabled:opacity-50",
      isSelected
        ? "bg-white text-slate-900 shadow-sm font-semibold dark:bg-slate-900 dark:text-white"
        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5",
    ),
    underline: cn(
      "relative inline-flex items-center justify-center whitespace-nowrap pb-3 pt-2 text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
      "disabled:pointer-events-none disabled:opacity-50",
      isSelected
        ? "text-brand-600 dark:text-brand-400 font-semibold border-b-2 border-brand-600 dark:border-brand-400 -mb-px"
        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent",
    ),
    pills: cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-2 min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm font-medium transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
      "disabled:pointer-events-none disabled:opacity-50",
      isSelected
        ? "bg-brand-600 text-white font-semibold shadow-sm"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
    ),
  };

  return (
    <button
      type="button"
      role="tab"
      id={triggerId}
      aria-selected={isSelected}
      aria-controls={contentId}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={handleClick}
      className={cn(variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

/**
 * Tab mazmuni (panel). Faqat tegishli tab tanlanganda ko'rinadi va 'fade-in' animatsiyasi bilan chiqadi.
 */
export function TabsContent({
  value: contentValue,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value, baseId } = useTabsContext();
  const isSelected = value === contentValue;
  const triggerId = `${baseId}-trigger-${contentValue}`;
  const contentId = `${baseId}-content-${contentValue}`;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      id={contentId}
      aria-labelledby={triggerId}
      tabIndex={0}
      className={cn(
        "fade-in outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
