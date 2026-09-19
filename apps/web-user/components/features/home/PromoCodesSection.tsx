import type { PromoView } from "@safaar/api-client";
import { PromoCodeCard } from "./PromoCodeCard";

export function PromoCodesSection({ promos }: { promos: PromoView[] }) {
  if (promos.length === 0) return null;

  return (
    <section className="mx-auto w-full md:w-[96%] max-w-[1536px] px-3 sm:px-4 md:px-8 py-10 sm:py-14">
      <div className="mb-4 sm:mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Promo-kodlar
        </h2>
        <p className="mt-0.5 text-xs font-medium text-slate-900/70 sm:text-sm">
          Bron qilishda ushbu kodlardan foydalanib chegirma oling
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {promos.map((promo) => (
          <PromoCodeCard key={promo.code} promo={promo} />
        ))}
      </div>
    </section>
  );
}
