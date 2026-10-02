import { Suspense } from "react";
import { UnifiedCheckoutClient } from "@/components/features/checkout/UnifiedCheckoutClient";
import { Metadata } from "next";
import { getDictionary } from "@/i18n/dictionaries";
import { Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Checkout - Safaar",
  description: "Complete your booking securely.",
};

export default async function CheckoutPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const dict = await getDictionary(lang as Locale, "checkout");

  return (
    <Suspense fallback={<div className="container mx-auto p-10 text-center">Loading checkout...</div>}>
      <UnifiedCheckoutClient dict={dict} />
    </Suspense>
  );
}
