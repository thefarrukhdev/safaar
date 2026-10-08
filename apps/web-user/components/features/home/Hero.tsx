import Image from "next/image";
import type { HomeDict } from "@/i18n/dictionaries";

export function Hero({
  dict,
  children,
  bannerUrl,
  heroBg,
}: {
  dict: HomeDict["hero"];
  children?: React.ReactNode;
  bannerUrl?: string;
  heroBg?: {
    imageUrl?: string;
    title?: string;
    subtitle?: string;
  };
}) {
  return (
    <section className="relative flex min-h-[60vh] md:min-h-[80vh] w-full flex-col items-center justify-center pb-10 -mt-[120px] md:-mt-[100px]">
      {/* Background image with slow zoom animation for premium feel */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={heroBg?.imageUrl || bannerUrl || "/registon-blue-sky.jpeg"}
          alt="Safaar — O'zbekiston"
          fill
          priority
          className="object-cover object-center animate-image-zoom"
          sizes="100vw"
          quality={90}
        />
        {/* Qatlam 1: Yuqori — header va nav himoyasi (nozik) */}
        <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-black/40 via-black/10 to-transparent" />
        {/* Qatlam 2: Yon tomonlar — chuqurlik effekti */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />
        {/* Qatlam 3: Markaziy matn himoyasi — faqat matn bo'lagida (qorong'i EMAS, nozik) */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/50" />
        {/* Qatlam 4: Pastki oq gradient — faqat search bar qismida */}
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white from-[25%] via-white/60 to-transparent" />
      </div>

      {/* Hero Text */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-28 md:pt-40 pb-12 text-center sm:px-6 lg:pt-56 lg:pb-16 flex-1 justify-center">
        {/* H1 — Display scale: Manrope 900, tracking tight */}
        <h1
          className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl animate-in fade-in zoom-in-95 duration-700 delay-100 [text-shadow:0_2px_20px_rgba(0,0,0,0.5),0_1px_4px_rgba(0,0,0,0.4)]"
          style={{ fontFamily: "var(--font-manrope, sans-serif)" }}
        >
          {heroBg?.title || dict.title}
        </h1>

        {/* Subtitle — Body LG: Inter 400 */}
        <p
          className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/90 sm:text-lg md:text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both drop-shadow-md"
        >
          {heroBg?.subtitle || dict.subtitle}
        </p>
      </div>

      {/* Render SearchBar and CityPills exactly here inside the hero background */}
      {children && (
        <div className="relative z-20 mx-auto w-full max-w-5xl px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.2,0,0,1)] delay-300">
          {children}
        </div>
      )}
    </section>
  );
}
