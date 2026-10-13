'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  animate,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue
} from 'motion/react';
import { Check } from 'lucide-react';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const WASH_IN = 0.3;
const WASH_OUT = 0.2;
const SINK_DELAY = 0.06;
const SINK_STEP = 0.03;
const CHECK_DELAY = 0.28;
const SINK_FADE = 0.6;

export type CodeSlotsStatus = 'idle' | 'error' | 'success';

export interface CodeSlotsProps {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  status?: CodeSlotsStatus;
  mask?: boolean;
  caret?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accentColor?: string;
  inkColor?: string;
  slotColor?: string;
  digitColor?: string;
  dangerColor?: string;
  slotSize?: number;
  gap?: number;
  radius?: number;
  bounce?: number;
  settle?: number;
  rise?: number;
  cascade?: number;
  ariaLabel?: string;
  className?: string;
}

interface Live {
  settle: number;
  bounce: number;
  cascade: number;
  reduce: boolean | null;
}

interface SlotProps {
  mv: MotionValue<number>;
  drop: MotionValue<number>;
  char: string;
  active: boolean;
  rise: number;
  sink: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const digitsOf = (raw: string | undefined) => String(raw ?? '').replace(/\D/g, '');
const toSlots = (raw: string | undefined, n: number) => {
  const d = digitsOf(raw).slice(0, n);
  return Array.from({ length: n }, (_, i) => d[i] ?? '');
};
const firstEmptyOf = (slots: string[]) => {
  const i = slots.indexOf('');
  return i === -1 ? slots.length - 1 : i;
};
const isFull = (slots: string[]) => slots.every(Boolean);
const STYLE = '@keyframes code-slots-blink{0%,49.9%{opacity:1}50%,100%{opacity:0}}';

export const CodeSlots: React.FC<CodeSlotsProps> = ({
  length = 6,
  value,
  defaultValue = '',
  onChange,
  onComplete,
  status = 'idle',
  mask = false,
  caret = true,
  disabled = false,
  autoFocus = false,
  accentColor = '#2563eb',
  inkColor = '#0f172a',
  slotColor = '#f1f5f9',
  digitColor = '#0f172a',
  dangerColor = '#ef4444',
  slotSize = 44,
  gap = 8,
  radius = 12,
  bounce = 0.2,
  settle = 0.3,
  rise = 8,
  cascade = 20,
  ariaLabel = 'One-time code',
  className = ''
}) => {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(() => toSlots(value ?? defaultValue, length));
  const [active, setActive] = useState(() => firstEmptyOf(slots));
  const [focused, setFocused] = useState(false);
  const [veiled, setVeiled] = useState(status === 'success');
  const activeMv = useMotionValue(active);
  const openMv = useMotionValue(status === 'success' ? 1 : 0);
  const checkMv = useMotionValue(status === 'success' ? 1 : 0);
  const glide = useRef<Set<number>>(new Set());

  const live = useMemo<Live>(
    () => ({
      settle: reduce ? 0 : Math.max(0.05, settle),
      bounce: reduce ? 0 : clamp01(bounce),
      cascade: reduce ? 0 : Math.max(0, cascade),
      reduce
    }),
    [reduce, settle, bounce, cascade]
  );

  const mvs = useMemo(() => {
    const initial = toSlots(value ?? defaultValue, length);
    return Array.from({ length }, (_, i) => motionValue(initial[i] ? 1 : 0));
  }, [value, defaultValue, length]);

  const drops = useMemo(
    () => Array.from({ length }, () => motionValue(0)),
    [length]
  );

  const view = value !== undefined ? toSlots(value, length) : slots;
  const isControlled = value !== undefined;

  const push = useCallback(
    (next: string[]) => {
      if (!isControlled) setSlots(next);
      const code = next.join('');
      onChange?.(code);
      if (isFull(next)) onComplete?.(code);
    },
    [isControlled, onChange, onComplete]
  );

  const step = useCallback(
    (index: number, to: number, delayMs = 0) => {
      const mv = mvs[index];
      if (!mv) return;
      if (live.reduce || live.settle === 0) {
        mv.set(to);
        return;
      }
      const run = () => {
        animate(mv, to, {
          type: 'spring',
          duration: live.settle,
          bounce: to === 1 ? live.bounce : 0
        });
      };
      if (delayMs > 0) {
        const id = window.setTimeout(run, delayMs);
        glide.current.add(id);
      } else {
        run();
      }
    },
    [mvs, live]
  );

  useEffect(() => {
    if (value === undefined) return;
    const next = toSlots(value, length);
    setSlots(next);
    next.forEach((char, i) => {
      const mv = mvs[i];
      if (!mv) return;
      const target = char ? 1 : 0;
      if (mv.get() !== target) mv.set(target);
    });
    setActive(firstEmptyOf(next));
  }, [value, length, mvs]);

  useEffect(() => {
    if (autoFocus && !disabled && status !== 'success') {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled, status]);

  useEffect(() => {
    const clearGlide = () => {
      glide.current.forEach((id) => clearTimeout(id));
      glide.current.clear();
    };
    if (status !== 'success') {
      clearGlide();
      setVeiled(false);
      openMv.set(0);
      checkMv.set(0);
      drops.forEach((d) => d.set(0));
      return;
    }
    setVeiled(true);
    if (live.reduce) {
      openMv.set(1);
      checkMv.set(1);
      return;
    }
    drops.forEach((d, i) => {
      const id = window.setTimeout(() => {
        animate(d, 1, {
          duration: SINK_FADE,
          ease: EASE_OUT
        });
      }, (SINK_DELAY + i * SINK_STEP) * 1000);
      glide.current.add(id);
    });
    animate(openMv, 1, { duration: WASH_IN, ease: EASE_OUT });
    const checkId = window.setTimeout(() => {
      animate(checkMv, 1, {
        duration: WASH_OUT,
        ease: EASE_OUT
      });
    }, CHECK_DELAY * 1000);
    glide.current.add(checkId);
    return clearGlide;
  }, [status, drops, openMv, checkMv, live.reduce]);

  useEffect(() => {
    if (live.reduce) {
      activeMv.set(active);
      return;
    }
    animate(activeMv, active, {
      type: 'spring',
      duration: live.settle,
      bounce: live.bounce
    });
  }, [active, activeMv, live]);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    e.target.value = '';
    const digits = digitsOf(raw);
    if (!digits) return;
    const next = [...view];
    let writeAt = view[active] ? firstEmptyOf(view) : active;
    if (writeAt === -1) writeAt = length - 1;
    for (let i = 0; i < digits.length && writeAt < length; i += 1) {
      next[writeAt] = digits[i];
      step(writeAt, 1, i * live.cascade);
      writeAt += 1;
    }
    push(next);
    setActive(Math.min(writeAt, length - 1));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || status === 'success') return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...view];
      const hasCurrent = Boolean(next[active]);
      if (hasCurrent) {
        next[active] = '';
        step(active, 0);
        push(next);
      } else if (active > 0) {
        const prev = active - 1;
        next[prev] = '';
        step(prev, 0);
        push(next);
        setActive(prev);
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActive((i) => Math.min(length - 1, i + 1));
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digits = digitsOf(pasted).slice(0, length);
    if (!digits) return;
    const next = Array.from({ length }, (_, i) => digits[i] ?? '');
    next.forEach((char, i) => {
      step(i, char ? 1 : 0, i * live.cascade);
    });
    push(next);
    setActive(firstEmptyOf(next));
  };

  const onRowMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || status === 'success') return;
    const row = rowRef.current;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const colWidth = rect.width / length;
    const idx = Math.min(length - 1, Math.max(0, Math.floor(x / colWidth)));
    setActive(idx);
    inputRef.current?.focus();
  };

  const height = Math.round(slotSize * 1.25);
  const fontSize = Math.round(slotSize * 0.48);
  const caretTransform = useTransform(
    activeMv,
    (i: number) => `translateX(${i * (slotSize + gap)}px)`
  );
  const washClip = useTransform(
    openMv,
    (t: number) => `inset(0 ${(1 - t) * 100}% 0 0 round ${radius}px)`
  );
  const checkTransform = useTransform(
    checkMv,
    (t: number) => `translateY(${(1 - t) * 8}px)`
  );
  const checkOpacity = useTransform(checkMv, [0, 0.4, 1], [0, 0.6, 1]);
  const showCaret = caret && focused && !view[active] && !veiled && status !== 'error';

  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={
        {
          '--cs-size': `${slotSize}px`,
          '--cs-height': `${height}px`,
          '--cs-gap': `${gap}px`,
          '--cs-radius': `${radius}px`,
          '--cs-font': `${fontSize}px`,
          '--cs-accent': accentColor,
          '--cs-ink': inkColor,
          '--cs-slot': slotColor,
          '--cs-digit': digitColor,
          '--cs-danger': dangerColor
        } as CSSProperties
      }
    >
      <style>{STYLE}</style>
      <div
        ref={rowRef}
        className="group/row relative inline-flex cursor-text touch-manipulation gap-[var(--cs-gap)] [-webkit-tap-highlight-color:transparent] [transition:opacity_200ms_ease] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        data-status={status}
        data-focused={focused ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        onMouseDown={onRowMouseDown}
      >
        <input
          ref={inputRef}
          className="absolute inset-0 z-[4] m-0 cursor-[inherit] appearance-none border-0 bg-transparent p-0 text-[16px] text-transparent opacity-0 outline-0 [caret-color:transparent]"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value=""
          maxLength={length}
          aria-label={ariaLabel}
          aria-invalid={status === 'error'}
          aria-describedby={`${uid}-count`}
          disabled={disabled}
          readOnly={status === 'success'}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onChange={onInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {view.map((ch, i) => (
          <Slot
            key={i}
            mv={mvs[i]}
            drop={drops[i]}
            char={mask && ch ? '•' : ch}
            active={focused && i === active}
            rise={rise}
            sink={Math.round(height * 0.5)}
          />
        ))}
        <motion.span
          className="pointer-events-none absolute inset-0 z-[1] grid place-items-center rounded-[var(--cs-radius)] bg-emerald-500 text-white motion-reduce:opacity-0 motion-reduce:[transition:opacity_200ms_ease] motion-reduce:in-data-[status=success]:opacity-100"
          aria-hidden="true"
          style={{ clipPath: washClip }}
        >
          <motion.span
            className="grid place-items-center motion-reduce:transform-none! motion-reduce:[transition:opacity_150ms_ease]"
            style={{ transform: checkTransform, opacity: checkOpacity }}
          >
            <Check size={Math.round(slotSize * 0.6)} strokeWidth={2.5} />
          </motion.span>
        </motion.span>
        <motion.span
          className="pointer-events-none absolute top-1/4 left-[calc(var(--cs-size)/2_-_0.75px)] z-[3] h-1/2 w-[1.5px] opacity-0 data-[show]:opacity-100"
          aria-hidden="true"
          data-show={showCaret ? '' : undefined}
          style={{ transform: caretTransform }}
        >
          <span
            key={active}
            className="block h-full w-full bg-[var(--cs-ink)] animate-[code-slots-blink_1s_linear_infinite] motion-reduce:animate-none"
          />
        </motion.span>
      </div>
      <span id={`${uid}-count`} className="sr-only" aria-live="polite">
        {status === 'success' ? 'Code accepted' : `${view.filter(Boolean).length} of ${length} digits entered`}
      </span>
    </div>
  );
};

function Slot({ mv, drop, char, active, rise, sink }: SlotProps) {
  const [shown, setShown] = useState(char);
  if (char && char !== shown) setShown(char);
  const fill = useTransform(mv, (t: number) => `scale(${Math.max(t, 0)})`);
  const lift = useTransform(
    [mv, drop],
    ([t, d]: number[]) => `translateY(${(1 - t) * rise + Math.max(d, 0) * sink}px)`
  );
  const ink = useTransform([mv, drop], ([t, d]: number[]) => clamp01(t) * (1 - clamp01(d / SINK_FADE)));
  return (
    <span
      className="relative h-[var(--cs-height)] w-[var(--cs-size)] overflow-hidden rounded-[var(--cs-radius)] bg-[var(--cs-slot)] select-none [transition:background-color_200ms_ease] border border-slate-200 data-[active]:border-blue-500 in-data-[status=error]:border-red-500 in-data-[status=error]:bg-red-50 data-[active]:[background-color:color-mix(in_srgb,var(--cs-ink)_4%,var(--cs-slot))] in-data-[status=error]:[background-color:color-mix(in_srgb,var(--cs-danger)_12%,var(--cs-slot))]"
      data-active={active ? '' : undefined}
      data-filled={char ? '' : undefined}
      aria-hidden="true"
    >
      <motion.span
        className="absolute inset-0 origin-center rounded-[inherit] bg-[var(--cs-accent)] opacity-10 [transition:background-color_200ms_ease] in-data-[status=error]:bg-[var(--cs-danger)] in-data-[status=error]:opacity-20"
        style={{ transform: fill }}
      />
      {shown ? (
        <motion.span
          className="absolute inset-0 z-[2] grid place-items-center text-[length:var(--cs-font)] leading-none font-bold tabular-nums font-mono [color:var(--cs-digit)] in-data-[status=error]:text-red-600 motion-reduce:transform-none! motion-reduce:[transition:opacity_150ms_ease]"
          style={{ transform: lift, opacity: ink }}
        >
          {shown}
        </motion.span>
      ) : null}
    </span>
  );
}

export default CodeSlots;
