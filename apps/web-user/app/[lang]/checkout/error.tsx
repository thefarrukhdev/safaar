"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Checkout Route Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
      <h2 className="mb-4 text-2xl font-bold text-slate-800">
        Nimadir xato ketdi... / Something went wrong
      </h2>
      <p className="mb-8 text-slate-600 max-w-md">
        Kechirasiz, to'lov sahifasini yuklashda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.
      </p>
      <Button variant="primary" onClick={() => reset()}>
        Qaytadan urinish / Retry
      </Button>
    </div>
  );
}
