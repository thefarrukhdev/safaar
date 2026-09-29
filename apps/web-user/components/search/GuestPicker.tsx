"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export function GuestPicker({ value, onChange }: Props) {
  const [inputValue, setInputValue] = useState(String(value));

  // Ota komponentdan kelgan qiymat o'zgarsa, ichki state'ni yangilaymiz
  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleBlur = () => {
    let num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 1) num = 1;
    if (num > 1000) num = 1000;
    setInputValue(String(num));
    if (num !== value) {
      onChange(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Faqat raqamlarni kiritishga ruxsat berish
    const val = e.target.value.replace(/[^0-9]/g, "");
    setInputValue(val);
    
    // Foydalanuvchi yozayotganda ham raqam bo'lsa darhol yangilash mumkin
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 1000) {
      onChange(num);
    }
  };

  const increment = () => {
    const next = Math.min(1000, value + 1);
    setInputValue(String(next));
    onChange(next);
  };

  const decrement = () => {
    const next = Math.max(1, value - 1);
    setInputValue(String(next));
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={decrement}
        disabled={value <= 1}
        className="grid h-8 w-8 place-items-center rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] text-slate-900 transition-colors duration-200 hover:bg-slate-900/[0.08] active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-slate-900/[0.05]"
        aria-label="Kamaytirish"
      >
        <Minus className="h-4 w-4 stroke-[2.5]" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-8 w-14 min-w-[3.5rem] rounded-md border-transparent bg-transparent text-center text-sm font-bold tabular-nums text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 dark:text-white dark:focus:bg-slate-800"
        aria-label="Mehmonlar soni"
      />

      <button
        type="button"
        onClick={increment}
        disabled={value >= 1000}
        className="grid h-8 w-8 place-items-center rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] text-slate-900 transition-colors duration-200 hover:bg-slate-900/[0.08] active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-slate-900/[0.05]"
        aria-label="Oshirish"
      >
        <Plus className="h-4 w-4 stroke-[2.5]" />
      </button>
    </div>
  );
}
