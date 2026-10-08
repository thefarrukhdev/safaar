"use client";

import { useEffect, useState } from "react";
import { RoughNotation as RN, type RoughNotationProps } from "react-rough-notation";

export function RoughNotation({
  children,
  show = true,
  ...props
}: RoughNotationProps & { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="inline-block">{children}</span>;
  }

  return (
    <RN show={show} {...props}>
      {children}
    </RN>
  );
}
