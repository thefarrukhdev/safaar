import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Safaar Payment Return",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body className="bg-transparent antialiased">
        {children}
      </body>
    </html>
  );
}
