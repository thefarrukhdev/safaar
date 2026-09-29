
/**
 * Auth layout — navbar/footer yo'q.
 * Faqat logo (bosh sahifaga qaytish) + til almashtirgich.
 * Focused auth experience — user faqat kirishga diqqat qiladi.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50 ">
      {/* Auth content */}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
