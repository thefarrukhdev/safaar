import { Suspense } from "react";
import { UnifiedCheckoutClient } from "@/components/features/checkout/UnifiedCheckoutClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout - Safaar",
  description: "Complete your booking securely.",
};

export default async function CheckoutPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;

  return (
    <Suspense fallback={<div className="container mx-auto p-10 text-center">Loading checkout...</div>}>
      <UnifiedCheckoutClient />
    </Suspense>
  );
}
