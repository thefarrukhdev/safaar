"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ isProcessing }: { isProcessing: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 4000);

    return () => clearInterval(interval);
  }, [isProcessing, router]);

  return null;
}
