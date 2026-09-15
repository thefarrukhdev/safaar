import { forwardRef, useState, useEffect, type ChangeEvent } from "react";
import { Input } from "./input";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

function formatMoney(value: string | number) {
  if (value === undefined || value === null) return '';
  const numbers = String(value).replace(/\D/g, '');
  if (!numbers) return '';
  
  return Number(numbers).toLocaleString('ru-RU');
}

export const MoneyInput = forwardRef<HTMLInputElement, InputProps>(function MoneyInput(
  { onChange, value, defaultValue, placeholder = "0", ...props },
  ref
) {
  const [internalValue, setInternalValue] = useState("");

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setInternalValue(formatMoney(value as string | number));
    } else if (defaultValue !== undefined && defaultValue !== null) {
      setInternalValue(formatMoney(defaultValue as string | number));
    }
  }, [value, defaultValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numbersOnly = rawValue.replace(/\D/g, '');
    const formatted = formatMoney(rawValue);
    
    setInternalValue(formatted);
    
    if (onChange) {
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: numbersOnly ? Number(numbersOnly) : '',
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
      type="text"
      inputMode="numeric"
      {...props}
    />
  );
});
