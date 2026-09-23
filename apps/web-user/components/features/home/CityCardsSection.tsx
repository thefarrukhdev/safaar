import { EmptyState } from "@/components/ui/EmptyState";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";
import type { Locale } from "@/i18n/config";
import type { HomeDict } from "@/i18n/dictionaries";
import { AccordionGallery } from "@/components/ui/AccordionGalleryClient";
import { CityCardsMobileCarousel } from "@/components/features/home/CityCardsMobileCarousel";
import { SectionHeader } from "@/components/ui/SectionHeader";

import { resolveImage } from "@/lib/images";

const FALLBACK_IMAGE = "/images/mock/Uzbekistan-travel.jpeg";

export async function CityCardsSection({
  locale,
  dict,
}: {
  locale: Locale;
  dict: HomeDict["popularCities"];
}) {
  // Admin panel ("Mashhur yo'nalishlar" — /cms/destinations) orqali
  // boshqariladi. Backend faqat faol/nashr qilingan yozuvlarni, admin
  // belgilagan tartibda qaytaradi — bu yerda qo'shimcha filtr/sort kerak
  // emas. API xato bersa ham sahifa buzilmasligi uchun try/catch bilan
  // o'raladi va bo'sh holat ko'rsatiladi.
  let destinations: Awaited<ReturnType<typeof api.catalog.getDestinations>> = [];
  try {
    destinations = await api.catalog.getDestinations(locale);
  } catch (error) {
    console.error("Failed to load popular destinations", error);
  }

  const cities = destinations
    .map((destination) => ({
      name: destination.name,
      image: resolveImage(destination.imageUrl) || FALLBACK_IMAGE,
      href:
        destination.link ||
        (destination.slug
          ? `/${locale}/hotels?city_id=${encodeURIComponent(destination.slug)}`
          : `/${locale}/hotels`),
    }))
    .filter((city) => city.name && city.image);

  const galleryItems = cities.map((city) => ({
    image: city.image,
    label: city.name,
    link: city.href,
    alt: city.name,
  }));

  return (
    <section aria-labelledby="city-cards-heading">
      <div className="mx-auto w-full md:w-[96%] max-w-[1536px] px-3 sm:px-4 md:px-8">
        <SectionHeader 
          title={dict.title}
          subtitle={dict.subtitle}
        />

        {cities.length === 0 ? (
          <div className="mt-6">
            <EmptyState 
              icon={<MapPin className="h-10 w-10 text-slate-400" />}
              title={dict.empty || "Hozircha bo'sh"}
              description={(dict as any).emptyDesc || "Ayni paytda mashhur shaharlar ro'yxati shakllanmoqda."} 
            />
          </div>
        ) : (
          <>
            {/* Desktop — Accordion Gallery */}
            <div className="hidden sm:block mt-6 sm:mt-8 w-full max-w-full overflow-hidden">
              <AccordionGallery
                items={galleryItems}
                height={400}
                accentColor="#0284c7"
                expandRatio={0.5}
                grayscale={false}
                radius={12}
              />
            </div>

            {/* Mobile — Swipeable Carousel */}
            <div className="sm:hidden mt-4">
              <CityCardsMobileCarousel items={galleryItems} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
