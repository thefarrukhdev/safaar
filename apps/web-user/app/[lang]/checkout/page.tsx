import { Suspense } from "react";
import { UnifiedCheckoutClient } from "@/components/features/checkout/UnifiedCheckoutClient";
import { Metadata } from "next";
import { defaultLocale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Checkout - Safaar",
  description: "Complete your booking securely.",
};

export default function CheckoutPage({
  params,
}: {
  params: { lang?: string };
}) {
  return (
    <Suspense fallback={<div className="container mx-auto p-10 text-center">Loading checkout...</div>}>
      <UnifiedCheckoutClient />
    </Suspense>
  );
}
