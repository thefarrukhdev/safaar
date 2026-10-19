"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type SelectHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../_lib/utils/cn";
import { useMounted } from "../../_hooks/use-mounted";

export interface SelectOptionItem {
  value: string;
  label: ReactNode;
  text?: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  error?: boolean;
  placeholder?: string;
  options?: SelectOptionItem[];
  containerClassName?: string;
  popoverClassName?: string;
}

export interface ParsedOption {
  value: string;
  label: ReactNode;
  text: string;
  disabled?: boolean;
  group?: string;
}

export type ParsedItem =
  | { kind: "option"; option: ParsedOption; globalIndex: number }
  | { kind: "group"; name: string; items: { option: ParsedOption; globalIndex: number }[] };

function getTextFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getTextFromNode).join("");
  }
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    if (props && props.children) {
      return getTextFromNode(props.children);
    }
  }
  return "";
}

function extractOptionFromElement(element: ReactElement, group?: string): ParsedOption | null {
  const props = element.props as {
    value?: string | number;
    children?: ReactNode;
    disabled?: boolean;
  };
  const val = props.value !== undefined ? String(props.value) : "";
  const text = getTextFromNode(props.children) || val;
  return {
    value: val,
    label: props.children ?? val,
    text,
    disabled: Boolean(props.disabled),
    group,
  };
}

function parseChildren(children: ReactNode): {
  flatOptions: ParsedOption[];
  parsedItems: ParsedItem[];
} {
  const flatOptions: ParsedOption[] = [];
  const parsedItems: ParsedItem[] = [];

  const traverse = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;

      if (child.type === "optgroup") {
        const groupProps = child.props as { label?: string; children?: ReactNode };
        const groupLabel = groupProps.label || "";
        const groupItems: { option: ParsedOption; globalIndex: number }[] = [];

        Children.forEach(groupProps.children, (optChild) => {
          if (!isValidElement(optChild)) return;
          const opt = extractOptionFromElement(optChild, groupLabel);
          if (opt) {
            const globalIndex = flatOptions.length;
            flatOptions.push(opt);
            groupItems.push({ option: opt, globalIndex });
          }
        });

        if (groupItems.length > 0) {
          parsedItems.push({ kind: "group", name: groupLabel, items: groupItems });
        }
      } else if (child.type === "option" || (child.props as { value?: unknown })?.value !== undefined) {
        const opt = extractOptionFromElement(child);
        if (opt) {
          const globalIndex = flatOptions.length;
          flatOptions.push(opt);
          parsedItems.push({ kind: "option", option: opt, globalIndex });
        }
      } else if ((child.props as { children?: ReactNode })?.children) {
        traverse((child.props as { children?: ReactNode }).children);
      }
    });
  };

  traverse(children);
  return { flatOptions, parsedItems };
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    containerClassName,
    popoverClassName,
    children,
    options: propOptions,
    error,
    placeholder,
    value: controlledValue,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    disabled,
    id,
    name,
    required,
    "aria-invalid": ariaInvalidProp,
    ...props
  },
  forwardedRef,
) {
  const mounted = useMounted();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nativeSelectRef = useRef<HTMLSelectElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const optionListRef = useRef<HTMLDivElement | null>(null);
  const optionItemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const autoId = useId();
  const selectId = id || `select-${autoId}`;
  const listboxId = `listbox-${selectId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeaheadQueryRef = useRef<string>("");

  // Options & Groups Parsing preserving sequence
  let flatOptions: ParsedOption[];
  let parsedItems: ParsedItem[];

  if (propOptions) {
    flatOptions = propOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
      text: opt.text || getTextFromNode(opt.label) || opt.value,
      disabled: opt.disabled,
      group: opt.group,
    }));

    const items: ParsedItem[] = [];
    let currentGroup: { name: string; items: { option: ParsedOption; globalIndex: number }[] } | null = null;

    flatOptions.forEach((opt, idx) => {
      if (opt.group) {
        if (!currentGroup || currentGroup.name !== opt.group) {
          currentGroup = { name: opt.group, items: [] };
          items.push({ kind: "group", name: opt.group, items: currentGroup.items });
        }
        currentGroup.items.push({ option: opt, globalIndex: idx });
      } else {
        currentGroup = null;
        items.push({ kind: "option", option: opt, globalIndex: idx });
      }
    });
    parsedItems = items;
  } else {
    const parsed = parseChildren(children);
    flatOptions = parsed.flatOptions;
    parsedItems = parsed.parsedItems;
  }

  // Uncontrolled vs Controlled state
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (controlledValue !== undefined) return String(controlledValue);
    if (defaultValue !== undefined) return String(defaultValue);
    if (placeholder) return "";
    if (flatOptions.length > 0) return flatOptions[0].value;
    return "";
  });

  const activeValue = isControlled ? String(controlledValue) : internalValue;

  // Sync internal state if controlledValue changes
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(String(controlledValue));
      if (nativeSelectRef.current && nativeSelectRef.current.value !== String(controlledValue)) {
        nativeSelectRef.current.value = String(controlledValue);
      }
    }
  }, [controlledValue]);

  // Sync with native select when initialized or options change
  useEffect(() => {
    const el = nativeSelectRef.current;
    if (!el) return;

    if (!isControlled && el.value !== activeValue && el.value !== "") {
      setInternalValue(el.value);
    }

    const handleNativeChange = () => {
      if (!isControlled) {
        setInternalValue(el.value);
      }
    };

    el.addEventListener("change", handleNativeChange);
    el.addEventListener("input", handleNativeChange);
    return () => {
      el.removeEventListener("change", handleNativeChange);
      el.removeEventListener("input", handleNativeChange);
    };
  }, [isControlled, activeValue]);

  // Combine forwarded ref and internal ref, intercepting instance value setter for React Hook Form setValue/reset
  const setNativeRef = useCallback(
    (node: HTMLSelectElement | null) => {
      nativeSelectRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }

      if (node && !(node as unknown as { _valuePatched?: boolean })._valuePatched) {
        (node as unknown as { _valuePatched?: boolean })._valuePatched = true;
        const descriptor = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        );
        Object.defineProperty(node, "value", {
          configurable: true,
          enumerable: true,
          get() {
            return descriptor?.get?.call(this) ?? "";
          },
          set(val) {
            descriptor?.set?.call(this, val);
            setInternalValue(String(val));
          },
        });
      }
    },
    [forwardedRef],
  );

  // Popover positioning with viewport constraints
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
  } | null>(null);

  const updatePopoverCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const minHeight = 220;
    const placement: "bottom" | "top" =
      spaceBelow < minHeight && spaceAbove > spaceBelow ? "top" : "bottom";

    const viewportWidth = window.innerWidth;
    const popoverWidth = rect.width;
    const maxLeft = Math.max(8, viewportWidth - popoverWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    setPopoverStyle({
      top: placement === "bottom" ? rect.bottom + 6 : rect.top - 6,
      left,
      width: popoverWidth,
      placement,
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    updatePopoverCoords();
    const activeIdx = flatOptions.findIndex((o) => o.value === activeValue);
    setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);
    setIsOpen(true);
  }, [disabled, updatePopoverCoords, flatOptions, activeValue]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    typeaheadQueryRef.current = "";
  }, []);

  // Capture-phase Escape key handler to close ONLY the select popover and prevent closing parent Dialog modals
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDownCapture = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDownCapture, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDownCapture, { capture: true });
    };
  }, [isOpen, closeMenu]);

  // Window resize & scroll positioning
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePopoverCoords();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
    };
  }, [isOpen, updatePopoverCoords]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, closeMenu]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const itemEl = optionItemRefs.current.get(highlightedIndex);
      if (itemEl && optionListRef.current) {
        itemEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  // Option selection
  const selectOption = useCallback(
    (option: ParsedOption) => {
      if (option.disabled) return;

      if (!isControlled) {
        setInternalValue(option.value);
      }

      const nativeEl = nativeSelectRef.current;
      if (nativeEl) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          "value",
        )?.set;
        if (valueSetter) {
          valueSetter.call(nativeEl, option.value);
        } else {
          nativeEl.value = option.value;
        }

        const changeEvent = new Event("change", { bubbles: true });
        nativeEl.dispatchEvent(changeEvent);

        const inputEvent = new Event("input", { bubbles: true });
        nativeEl.dispatchEvent(inputEvent);
      }

      if (onChange) {
        const syntheticEvent = {
          target: nativeEl ?? { value: option.value, name, id: selectId },
          currentTarget: nativeEl ?? { value: option.value, name, id: selectId },
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }

      closeMenu();
      triggerRef.current?.focus();
    },
    [isControlled, closeMenu, onChange, name, selectId],
  );

  // Keyboard navigation
  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      const direction = e.key === "ArrowDown" ? 1 : -1;
      let nextIdx = highlightedIndex + direction;
      while (nextIdx >= 0 && nextIdx < flatOptions.length && flatOptions[nextIdx]?.disabled) {
        nextIdx += direction;
      }
      if (nextIdx >= 0 && nextIdx < flatOptions.length) {
        setHighlightedIndex(nextIdx);
      }
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else if (highlightedIndex >= 0 && flatOptions[highlightedIndex]) {
        selectOption(flatOptions[highlightedIndex]);
      }
      return;
    }

    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
      return;
    }

    if (e.key === "Tab") {
      if (isOpen) {
        closeMenu();
      }
      return;
    }

    if (e.key === "Home") {
      if (isOpen) {
        e.preventDefault();
        const first = flatOptions.findIndex((o) => !o.disabled);
        if (first >= 0) setHighlightedIndex(first);
      }
      return;
    }

    if (e.key === "End") {
      if (isOpen) {
        e.preventDefault();
        for (let i = flatOptions.length - 1; i >= 0; i--) {
          if (!flatOptions[i].disabled) {
            setHighlightedIndex(i);
            break;
          }
        }
      }
      return;
    }

    // Type-ahead navigation
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      typeaheadQueryRef.current += e.key.toLowerCase();
      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadQueryRef.current = "";
      }, 500);

      if (!isOpen) openMenu();

      const matchedIdx = flatOptions.findIndex(
        (opt) => !opt.disabled && opt.text.toLowerCase().startsWith(typeaheadQueryRef.current),
      );
      if (matchedIdx >= 0) {
        setHighlightedIndex(matchedIdx);
      }
    }
  };

  // Find active option display text
  const currentOption = flatOptions.find((o) => o.value === activeValue);
  const isPlaceholderActive =
    !currentOption || (currentOption.value === "" && Boolean(placeholder));
  const displayText = currentOption
    ? currentOption.label
    : placeholder || (flatOptions[0]?.label ?? "");

  const isInvalid = error || ariaInvalidProp === true || ariaInvalidProp === "true";

  const renderOptionButton = (opt: ParsedOption, globalIdx: number) => {
    const isSelected = opt.value === activeValue;
    const isHighlighted = globalIdx === highlightedIndex;

    return (
      <button
        key={`${opt.value}-${globalIdx}`}
        ref={(node) => {
          if (node) optionItemRefs.current.set(globalIdx, node);
          else optionItemRefs.current.delete(globalIdx);
        }}
        type="button"
        id={`${selectId}-option-${globalIdx}`}
        role="option"
        aria-selected={isSelected}
        aria-disabled={opt.disabled}
        disabled={opt.disabled}
        onClick={() => selectOption(opt)}
        onMouseEnter={() => !opt.disabled && setHighlightedIndex(globalIdx)}
        className={cn(
          "relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors select-none",
          isHighlighted && "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100",
          isSelected &&
            "bg-blue-50/80 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
          opt.disabled && "cursor-not-allowed opacity-40",
        )}
      >
        <span className="truncate pr-4">{opt.label}</span>
        {isSelected && (
          <Check
            className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
        )}
      </button>
    );
  };

  return (
    <div className={cn("relative w-full", containerClassName)}>
      {/* Hidden native select for form serialization, accessibility fallback & React Hook Form */}
      <select
        ref={setNativeRef}
        id={`${selectId}-native`}
        name={name}
        value={activeValue}
        required={required}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={onChange}
        onBlur={onBlur}
        onInvalid={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
        }}
        onFocus={() => {
          onFocus?.({} as unknown as React.FocusEvent<HTMLSelectElement>);
          triggerRef.current?.focus();
        }}
        {...props}
      >
        {children ? (
          children
        ) : (
          flatOptions.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.text}
            </option>
          ))
        )}
      </select>

      {/* Modern Apple/Linear interactive trigger button */}
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-invalid={isInvalid}
        aria-required={required}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "group flex h-10 w-full items-center justify-between rounded-xl border px-3.5 text-sm font-normal text-left transition-all duration-150 select-none",
          "border-slate-200 bg-white/90 text-slate-900 shadow-2xs backdrop-blur-md",
          "hover:border-slate-300 hover:bg-slate-50/80",
          "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          "focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25",
          "dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100",
          "dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70",
          "dark:focus:border-blue-500 dark:focus:ring-blue-500/30",
          "dark:focus-visible:border-blue-500 dark:focus-visible:ring-blue-500/30",
          isInvalid &&
            "border-red-500 ring-2 ring-red-500/20 focus:border-red-600 focus:ring-red-500/25 dark:border-red-500 dark:ring-red-500/20",
          disabled &&
            "cursor-not-allowed opacity-50 hover:border-slate-200 hover:bg-white/90 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/90",
          className,
        )}
      >
        <span
          className={cn(
            "truncate pr-2",
            isPlaceholderActive ? "text-slate-400 dark:text-zinc-500" : "text-slate-900 dark:text-zinc-100",
          )}
        >
          {displayText}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ease-out dark:text-zinc-500",
            isOpen && "rotate-180 text-blue-600 dark:text-blue-400",
          )}
          aria-hidden="true"
        />
      </button>

      {/* Floating Popover rendered in document.body to avoid clipping inside modals/dialogs */}
      {mounted &&
        isOpen &&
        popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-label={props["aria-label"] || "Variantlar"}
            aria-labelledby={props["aria-labelledby"]}
            style={{
              position: "fixed",
              top: popoverStyle.placement === "bottom" ? popoverStyle.top : undefined,
              bottom:
                popoverStyle.placement === "top"
                  ? window.innerHeight - popoverStyle.top
                  : undefined,
              left: popoverStyle.left,
              width: popoverStyle.width,
              zIndex: 9999,
            }}
            className={cn(
              "overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 p-1 text-slate-900 shadow-2xl shadow-slate-900/10 backdrop-blur-xl",
              "dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-black/50",
              popoverStyle.placement === "bottom"
                ? "animate-in fade-in zoom-in-95 origin-top duration-150 ease-out"
                : "animate-in fade-in zoom-in-95 origin-bottom duration-150 ease-out",
              popoverClassName,
            )}
          >
            <div
              ref={optionListRef}
              className="max-h-60 overflow-y-auto overscroll-contain py-0.5 custom-scrollbar"
            >
              {parsedItems.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-zinc-500">
                  Ma'lumot topilmadi
                </div>
              ) : (
                parsedItems.map((item, idx) => {
                  if (item.kind === "group") {
                    return (
                      <div key={`group-${item.name}-${idx}`} className="py-1">
                        <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                          {item.name}
                        </div>
                        {item.items.map((child) =>
                          renderOptionButton(child.option, child.globalIndex),
                        )}
                      </div>
                    );
                  }
                  return renderOptionButton(item.option, item.globalIndex);
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
