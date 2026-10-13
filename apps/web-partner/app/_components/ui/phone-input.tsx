"use client";

import { forwardRef, useState, useEffect, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Input } from "./input";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, '');
  let result = '+998 ';
  
  let cleaned = numbers;
  if (cleaned.startsWith('998')) {
    cleaned = cleaned.substring(3);
  }
  
  if (cleaned.length === 0) return '';
  if (cleaned.length > 0) result += cleaned.substring(0, 2);
  if (cleaned.length > 2) result += ' ' + cleaned.substring(2, 5);
  if (cleaned.length > 5) result += ' ' + cleaned.substring(5, 7);
  if (cleaned.length > 7) result += ' ' + cleaned.substring(7, 9);
  
  return result;
}

export const PhoneInput = forwardRef<HTMLInputElement, InputProps>(function PhoneInput(
  {
    onChange,
    value,
    defaultValue,
    placeholder = "+998 __ ___ __ __",
    autoComplete = "tel",
    inputMode = "tel",
    type = "tel",
    ...props
  },
  ref
) {
  const [internalValue, setInternalValue] = useState(() => {
    if (value !== undefined && value !== null) {
      return formatPhone(String(value));
    }
    if (defaultValue !== undefined && defaultValue !== null) {
      return formatPhone(String(defaultValue));
    }
    return "";
  });

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setInternalValue(formatPhone(String(value)));
    } else if (defaultValue !== undefined && defaultValue !== null) {
      setInternalValue(formatPhone(String(defaultValue)));
    }
  }, [value, defaultValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let formatted = formatPhone(rawValue);
    
    if (rawValue.replace(/\D/g, '') === '998' || rawValue === '+' || rawValue === '+9' || rawValue === '+99') {
      formatted = '';
    }

    setInternalValue(formatted);
    
    if (onChange) {
      const unformatted = formatted.replace(/\s/g, '');
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: unformatted,
        }
      };
      onChange(newEvent as any);
    }
  };

  return (
    <Input
      ref={ref}
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      type={type}
      autoComplete={autoComplete}
      inputMode={inputMode}
      {...props}
    />
  );
});
