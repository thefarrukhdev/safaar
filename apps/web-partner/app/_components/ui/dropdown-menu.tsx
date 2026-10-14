"use client";

import { Slot } from "@radix-ui/react-slot";
import { Check, Circle } from "lucide-react";
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useMounted } from "../../_hooks/use-mounted";
import { cn } from "../../_lib/utils/cn";

/* -------------------------------------------------------------------------------------------------
 * Context & Types
 * -----------------------------------------------------------------------------------------------*/

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  menuId: string;
  triggerId: string;
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  registerItem: (id: string, element: HTMLElement, disabled?: boolean, text?: string) => void;
  unregisterItem: (id: string) => void;
  items: { id: string; element: HTMLElement; disabled?: boolean; text: string }[];
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu compound komponentlari <DropdownMenu> ichida ishlatilishi kerak");
  }
  return context;
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/* -------------------------------------------------------------------------------------------------
 * DropdownMenu (Root)
 * -----------------------------------------------------------------------------------------------*/

export function DropdownMenu({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [items, setItems] = useState<{ id: string; element: HTMLElement; disabled?: boolean; text: string }[]>([]);

  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const baseId = useId();
  const menuId = `menu-${baseId}`;
  const triggerId = `menu-trigger-${baseId}`;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
      if (!nextOpen) {
        setHighlightedIndex(-1);
      }
    },
    [isControlled, onOpenChange],
  );

  const registerItem = useCallback((id: string, element: HTMLElement, disabled?: boolean, text?: string) => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return [
        ...filtered,
        {
          id,
          element,
          disabled,
          text: text || element.textContent || "",
        },
      ];
    });
  }, []);

  const unregisterItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <DropdownMenuContext.Provider
      value={{
        open,
        setOpen,
        triggerRef,
        contentRef,
        menuId,
        triggerId,
        highlightedIndex,
        setHighlightedIndex,
        registerItem,
        unregisterItem,
        items,
      }}
    >
      {children}
    </DropdownMenuContext.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuTrigger
 * -----------------------------------------------------------------------------------------------*/

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children: ReactNode;
}

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger({ asChild, children, className, onClick, onKeyDown, ...props }, ref) {
    const { open, setOpen, triggerRef, triggerId, menuId, setHighlightedIndex } = useDropdownMenuContext();

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      setOpen(!open);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex(0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex(-1); // will focus last item on mount
      }
    };

    const mergedRef = (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof ref === "function") {
        ref(node as HTMLButtonElement | null);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node as HTMLButtonElement | null;
      }
    };

    const triggerProps = {
      id: triggerId,
      ref: mergedRef,
      "aria-haspopup": "menu" as const,
      "aria-expanded": open,
      "aria-controls": open ? menuId : undefined,
      "data-state": open ? "open" : "closed",
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      className,
      ...props,
    };

    if (asChild) {
      return <Slot {...triggerProps}>{children}</Slot>;
    }

    return (
      <button type="button" {...triggerProps}>
        {children}
      </button>
    );
  },
);

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuContent
 * -----------------------------------------------------------------------------------------------*/

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
}

interface Coords {
  top: number;
  left: number;
  placement: "top" | "bottom" | "left" | "right";
  maxHeight?: number;
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  function DropdownMenuContent(
    {
      side = "bottom",
      align = "start",
      sideOffset = 6,
      alignOffset = 0,
      avoidCollisions = true,
      className,
      children,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const {
      open,
      setOpen,
      triggerRef,
      contentRef,
      menuId,
      triggerId,
      highlightedIndex,
      setHighlightedIndex,
      items,
    } = useDropdownMenuContext();

    const mounted = useMounted();
    const [coords, setCoords] = useState<Coords>({
      top: 0,
      left: 0,
      placement: side,
    });

    const typeaheadQueryRef = useRef("");
    const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Calculate dynamic coords based on trigger bounding rect & viewport collisions
    const updatePosition = useCallback(() => {
      const triggerEl = triggerRef.current;
      const contentEl = contentRef.current;
      if (!triggerEl) return;

      const triggerRect = triggerEl.getBoundingClientRect();
      const contentWidth = contentEl ? contentEl.offsetWidth : 200;
      const contentHeight = contentEl ? contentEl.offsetHeight : 220;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8;

      let chosenSide = side;
      let top = 0;
      let left = 0;

      // Handle vertical collision check for top/bottom
      if (avoidCollisions) {
        if (side === "bottom") {
          const spaceBelow = viewportHeight - triggerRect.bottom - sideOffset;
          const spaceAbove = triggerRect.top - sideOffset;
          if (spaceBelow < contentHeight && spaceAbove > spaceBelow) {
            chosenSide = "top";
          }
        } else if (side === "top") {
          const spaceAbove = triggerRect.top - sideOffset;
          const spaceBelow = viewportHeight - triggerRect.bottom - sideOffset;
          if (spaceAbove < contentHeight && spaceBelow > spaceAbove) {
            chosenSide = "bottom";
          }
        }
      }

      // Compute Top
      if (chosenSide === "bottom") {
        top = triggerRect.bottom + sideOffset;
      } else if (chosenSide === "top") {
        top = triggerRect.top - contentHeight - sideOffset;
      } else {
        // side left or right
        top = triggerRect.top + (triggerRect.height - contentHeight) / 2;
      }

      // Compute Left
      if (chosenSide === "left") {
        left = triggerRect.left - contentWidth - sideOffset;
      } else if (chosenSide === "right") {
        left = triggerRect.right + sideOffset;
      } else {
        // bottom or top side
        if (align === "start") {
          left = triggerRect.left + alignOffset;
        } else if (align === "end") {
          left = triggerRect.right - contentWidth - alignOffset;
        } else {
          // center
          left = triggerRect.left + (triggerRect.width - contentWidth) / 2 + alignOffset;
        }
      }

      // Clamping to screen viewport
      const maxLeft = viewportWidth - contentWidth - padding;
      left = Math.min(Math.max(padding, left), maxLeft);

      const maxTop = viewportHeight - contentHeight - padding;
      top = Math.min(Math.max(padding, top), maxTop);

      setCoords({
        top,
        left,
        placement: chosenSide,
        maxHeight: Math.max(160, viewportHeight - padding * 2),
      });
    }, [triggerRef, contentRef, side, align, sideOffset, alignOffset, avoidCollisions]);

    // Initial position update when opened & re-measuring
    useEffect(() => {
      if (!open) return;
      updatePosition();
      const animFrame = requestAnimationFrame(updatePosition);
      return () => cancelAnimationFrame(animFrame);
    }, [open, updatePosition]);

    // Scroll & Resize auto-positioning
    useEffect(() => {
      if (!open) return;

      const handleScrollOrResize = () => {
        updatePosition();
      };

      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });

      return () => {
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      };
    }, [open, updatePosition]);

    // Click outside handler (pointerdown)
    useEffect(() => {
      if (!open) return;

      const handlePointerDown = (e: globalThis.PointerEvent) => {
        const target = e.target as Node | null;
        if (
          triggerRef.current?.contains(target) ||
          contentRef.current?.contains(target)
        ) {
          return;
        }
        setOpen(false);
      };

      document.addEventListener("pointerdown", handlePointerDown);
      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
      };
    }, [open, setOpen, triggerRef, contentRef]);

    // Capture-phase Escape key handler to close ONLY this dropdown menu and not parent dialogs
    useEffect(() => {
      if (!open) return;

      const handleKeyDownCapture = (e: globalThis.KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      };

      document.addEventListener("keydown", handleKeyDownCapture, { capture: true });
      return () => {
        document.removeEventListener("keydown", handleKeyDownCapture, { capture: true });
      };
    }, [open, setOpen, triggerRef]);

    // Focus management on mount
    useEffect(() => {
      if (!open) return;
      // If index was -1 on open from ArrowUp, select the last item
      if (highlightedIndex === -1 && items.length > 0) {
        const lastEnabled = [...items].reverse().findIndex((item) => !item.disabled);
        if (lastEnabled !== -1) {
          setHighlightedIndex(items.length - 1 - lastEnabled);
        }
      } else if (highlightedIndex >= 0 && items[highlightedIndex]) {
        items[highlightedIndex].element.focus();
      }
    }, [open, highlightedIndex, items, setHighlightedIndex]);

    // Keyboard navigation within the dropdown
    const handleContentKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      const enabledIndices = items
        .map((it, idx) => (!it.disabled ? idx : -1))
        .filter((idx) => idx !== -1);

      if (enabledIndices.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(highlightedIndex);
        const nextIdx = currentPos === -1 || currentPos === enabledIndices.length - 1
          ? enabledIndices[0]
          : enabledIndices[currentPos + 1];
        setHighlightedIndex(nextIdx);
        items[nextIdx]?.element.focus();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(highlightedIndex);
        const prevIdx = currentPos === -1 || currentPos === 0
          ? enabledIndices[enabledIndices.length - 1]
          : enabledIndices[currentPos - 1];
        setHighlightedIndex(prevIdx);
        items[prevIdx]?.element.focus();
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        const firstIdx = enabledIndices[0];
        setHighlightedIndex(firstIdx);
        items[firstIdx]?.element.focus();
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        const lastIdx = enabledIndices[enabledIndices.length - 1];
        setHighlightedIndex(lastIdx);
        items[lastIdx]?.element.focus();
        return;
      }

      if (e.key === "Tab") {
        // Close menu on tab to maintain predictable focus flow
        setOpen(false);
        return;
      }

      // Typeahead character search
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (typeaheadTimerRef.current) {
          clearTimeout(typeaheadTimerRef.current);
        }
        typeaheadQueryRef.current += e.key.toLowerCase();
        typeaheadTimerRef.current = setTimeout(() => {
          typeaheadQueryRef.current = "";
        }, 500);

        const matchIdx = items.findIndex(
          (item) => !item.disabled && item.text.toLowerCase().startsWith(typeaheadQueryRef.current),
        );
        if (matchIdx !== -1) {
          setHighlightedIndex(matchIdx);
          items[matchIdx]?.element.focus();
        }
      }
    };

    const mergedRef = (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    };

    if (!open || !mounted) return null;

    return createPortal(
      <div
        id={menuId}
        ref={mergedRef}
        role="menu"
        aria-labelledby={triggerId}
        tabIndex={-1}
        onKeyDown={handleContentKeyDown}
        data-state={open ? "open" : "closed"}
        data-side={coords.placement}
        style={{
          position: "fixed",
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          maxHeight: coords.maxHeight ? `${coords.maxHeight}px` : undefined,
        }}
        className={cn(
          "z-[100] min-w-[190px] overflow-x-hidden overflow-y-auto rounded-xl p-1.5",
          // Apple / Linear glassmorphic styling
          "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl",
          "border border-zinc-200/80 dark:border-zinc-800/80",
          "text-zinc-900 dark:text-zinc-100",
          "shadow-[0_12px_36px_-6px_rgba(0,0,0,0.15),0_4px_12px_-2px_rgba(0,0,0,0.08)]",
          "dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7),0_4px_12px_rgba(0,0,0,0.5)]",
          // Micro-interaction animations
          "animate-in fade-in-0 zoom-in-95 duration-150 ease-out",
          coords.placement === "bottom" && "slide-in-from-top-1",
          coords.placement === "top" && "slide-in-from-bottom-1",
          coords.placement === "left" && "slide-in-from-right-1",
          coords.placement === "right" && "slide-in-from-left-1",
          className,
        )}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuItem
 * -----------------------------------------------------------------------------------------------*/

export interface DropdownMenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  asChild?: boolean;
  destructive?: boolean;
  inset?: boolean;
  onSelect?: (e: Event) => void;
  preventClose?: boolean;
  children: ReactNode;
}

export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  function DropdownMenuItem(
    {
      asChild,
      destructive = false,
      inset = false,
      disabled = false,
      preventClose = false,
      onSelect,
      onClick,
      onPointerEnter,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const { setOpen, triggerRef, registerItem, unregisterItem, items, setHighlightedIndex } = useDropdownMenuContext();
    const itemId = useId();
    const internalRef = useRef<HTMLButtonElement | null>(null);

    // Register with parent context for roving focus and typeahead
    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      registerItem(itemId, el, disabled, el.textContent || "");
      return () => unregisterItem(itemId);
    }, [itemId, disabled, registerItem, unregisterItem]);

    const handleSelect = (e: MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
      if (e.defaultPrevented) return;

      const customEvent = new CustomEvent("select", { cancelable: true });
      onSelect?.(customEvent);

      if (!preventClose && !customEvent.defaultPrevented) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerEnter = (e: PointerEvent<HTMLButtonElement>) => {
      onPointerEnter?.(e);
      if (disabled) return;
      const idx = items.findIndex((it) => it.id === itemId);
      if (idx !== -1) {
        setHighlightedIndex(idx);
        internalRef.current?.focus();
      }
    };

    const mergedRef = (node: HTMLButtonElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }
    };

    const itemClasses = cn(
      "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-left outline-none select-none cursor-pointer",
      "transition-colors duration-100",
      inset && "pl-8",
      destructive
        ? "text-red-600 dark:text-red-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/40 dark:focus:text-red-300"
        : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white focus:bg-zinc-100 focus:text-zinc-900 dark:focus:bg-zinc-800 dark:focus:text-white",
      disabled && "opacity-50 pointer-events-none cursor-not-allowed",
      className,
    );

    const itemProps = {
      ref: mergedRef,
      role: "menuitem" as const,
      tabIndex: -1,
      "aria-disabled": disabled ? true : undefined,
      disabled,
      onClick: handleSelect,
      onPointerEnter: handlePointerEnter,
      className: itemClasses,
      ...props,
    };

    if (asChild) {
      return <Slot {...itemProps}>{children}</Slot>;
    }

    return (
      <button type="button" {...itemProps}>
        {children}
      </button>
    );
  },
);

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuCheckboxItem
 * -----------------------------------------------------------------------------------------------*/

export interface DropdownMenuCheckboxItemProps extends DropdownMenuItemProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const DropdownMenuCheckboxItem = forwardRef<HTMLButtonElement, DropdownMenuCheckboxItemProps>(
  function DropdownMenuCheckboxItem(
    { checked = false, onCheckedChange, children, className, ...props },
    ref,
  ) {
    return (
      <DropdownMenuItem
        ref={ref}
        role="menuitemcheckbox"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn("relative pl-8 pr-2.5", className)}
        {...props}
      >
        <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
          {checked && <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />}
        </span>
        {children}
      </DropdownMenuItem>
    );
  },
);

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuRadioItem
 * -----------------------------------------------------------------------------------------------*/

export interface DropdownMenuRadioItemProps extends DropdownMenuItemProps {
  value: string;
}

interface DropdownMenuRadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = createContext<DropdownMenuRadioGroupContextValue | null>(null);

export interface DropdownMenuRadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export function DropdownMenuRadioGroup({ value, onValueChange, children }: DropdownMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div role="group">{children}</div>
    </RadioGroupContext.Provider>
  );
}

export const DropdownMenuRadioItem = forwardRef<HTMLButtonElement, DropdownMenuRadioItemProps>(
  function DropdownMenuRadioItem({ value, children, className, ...props }, ref) {
    const groupContext = useContext(RadioGroupContext);
    const checked = groupContext?.value === value;

    return (
      <DropdownMenuItem
        ref={ref}
        role="menuitemradio"
        aria-checked={checked}
        onClick={() => groupContext?.onValueChange?.(value)}
        className={cn("relative pl-8 pr-2.5", className)}
        {...props}
      >
        <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
          {checked && <Circle className="h-2 w-2 fill-brand-600 text-brand-600 dark:fill-brand-400 dark:text-brand-400" />}
        </span>
        {children}
      </DropdownMenuItem>
    );
  },
);

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuLabel
 * -----------------------------------------------------------------------------------------------*/

export interface DropdownMenuLabelProps extends HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

export function DropdownMenuLabel({ inset, className, children, ...props }: DropdownMenuLabelProps) {
  return (
    <div
      className={cn(
        "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuSeparator
 * -----------------------------------------------------------------------------------------------*/

export function DropdownMenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("-mx-1.5 my-1 h-px bg-zinc-200/80 dark:bg-zinc-800/80", className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuGroup
 * -----------------------------------------------------------------------------------------------*/

export function DropdownMenuGroup({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="group" className={cn("flex flex-col gap-0.5", className)} {...props}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DropdownMenuShortcut
 * -----------------------------------------------------------------------------------------------*/

export function DropdownMenuShortcut({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto text-[10px] font-medium tracking-widest text-zinc-400 dark:text-zinc-500",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
