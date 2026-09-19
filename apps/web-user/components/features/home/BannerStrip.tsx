import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { BannerView } from "@safaar/api-client";

export function BannerStrip({
  banners,
  locale,
}: {
  banners: BannerView[];
  locale: Locale;
}) {
  if (banners.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-none pb-2">
        {banners.map((banner) => {
          const content = (
            <div className="relative h-40 w-[85vw] max-w-[640px] shrink-0 snap-center overflow-hidden rounded-xl bg-slate-100 sm:h-52 sm:w-full dark:bg-slate-800">
              {banner.imageUrl ? (
                <Image
                  src={banner.imageUrl}
                  alt={banner.title}
                  fill
                  className="object-cover"
                  sizes="(min-width: 640px) 100vw, 85vw"
                />
              ) : null}
              {banner.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <span className="text-sm font-bold text-white sm:text-base">
                    {banner.title}
                  </span>
                </div>
              )}
            </div>
          );

          return banner.link ? (
            <Link
              key={banner.id}
              href={banner.link.startsWith(`/${locale}`) ? banner.link : `/${locale}${banner.link}`}
              className="shrink-0"
            >
              {content}
            </Link>
          ) : (
            <div key={banner.id} className="shrink-0">
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
