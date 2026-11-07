"use client";

import { type ReactNode } from "react";
import { FluidDropdown } from "./FluidDropdown";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
  label?: string;
  icon?: ReactNode;
  align?: "left" | "right";
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  buttonClassName,
  menuClassName,
  ariaLabel,
  label,
  icon,
  align,
  disabled,
}: SelectProps) {
  return (
    <FluidDropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      buttonClassName={buttonClassName}
      menuClassName={menuClassName}
      ariaLabel={ariaLabel}
      label={label}
      icon={icon}
      align={align}
      disabled={disabled}
    />
  );
}

export default Select;
