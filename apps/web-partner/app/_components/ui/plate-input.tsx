import { forwardRef, useState, useEffect, type ChangeEvent } from "react";
import { Input } from "./input";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

function formatPlate(value: string) {
  if (!value) return '';
  
  // O'zbekiston raqamlari qoidalari: 
  // - Barcha harflar katta bo'ladi
  // - Faqat lotin harflari va raqamlar
  // - Probel yoki tirelarni olib tashlash
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  let result = '';
  // Format: 01 A 123 AA
  // Yoki 01 123 AAA
  
  if (raw.length === 0) return '';
  
  // Viloyat kodi (2ta raqam)
  result += raw.substring(0, 2);
  
  if (raw.length > 2) {
    result += ' ';
    
    // Uchinchi belgi harf yoki raqam bo'lishi mumkin
    // Jismoniy shaxs: 01 A ...
    // Yuridik shaxs: 01 123 ...
    const isPhysical = /[A-Z]/.test(raw[2]);
    
    if (isPhysical) {
      result += raw.substring(2, 3); // Bitta harf
      if (raw.length > 3) result += ' ' + raw.substring(3, 6); // Uchta raqam
      if (raw.length > 6) result += ' ' + raw.substring(6, 8); // Ikkita harf
    } else {
      result += raw.substring(2, 5); // Uchta raqam
      if (raw.length > 5) result += ' ' + raw.substring(5, 8); // Uchta harf
    }
  }
  
  return result;
}

export const PlateInput = forwardRef<HTMLInputElement, InputProps>(function PlateInput(
  { onChange, value, defaultValue, placeholder = "01 A 123 AA", ...props },
  ref
) {
  const [internalValue, setInternalValue] = useState("");

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setInternalValue(formatPlate(String(value)));
    } else if (defaultValue !== undefined && defaultValue !== null) {
      setInternalValue(formatPlate(String(defaultValue)));
    }
  }, [value, defaultValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatPlate(rawValue);
    
    setInternalValue(formatted);
    
    if (onChange) {
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted.replace(/\s/g, ''),
        }
      };
      onChange(newEvent as any);
    }
  };

  return (
    <Input
      ref={ref}
      value={value !== undefined ? internalValue : undefined}
      defaultValue={value === undefined ? internalValue : undefined}
      onChange={handleChange}
      placeholder={placeholder}
      style={{ textTransform: 'uppercase' }}
      {...props}
    />
  );
});
