import Image from "next/image";
import type { HomeDict } from "@/i18n/dictionaries";

export function Hero({ dict, children, bannerUrl }: { dict: HomeDict["hero"], children?: React.ReactNode, bannerUrl?: string }) {
  return (
    <section className="relative flex min-h-[70vh] md:min-h-[80vh] w-full flex-col items-center justify-center pb-10">
      {/* Background image with slow zoom animation for premium feel */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={bannerUrl || "/images/heroes/hero.png"}
          alt="Safaar — O'zbekiston"
          fill
          priority
          className="object-cover object-center animate-image-zoom"
          sizes="100vw"
          quality={90}
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/30" />
        {/* Bottom white gradient blending with content */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white via-white/80 to-transparent" />
      </div>

      {/* Hero Text */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-28 pb-12 text-center sm:px-6 lg:pt-36 lg:pb-16 flex-1 justify-center">
        {/* H1 — Display scale: Manrope 900, tracking tight */}
        <h1
          className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-lg animate-in fade-in zoom-in-95 duration-700 delay-100"
          style={{ fontFamily: "var(--font-manrope, sans-serif)" }}
        >
          {dict.title}
        </h1>

        {/* Subtitle — Body LG: Inter 400 */}
        <p
          className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/90 sm:text-lg md:text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both drop-shadow-md"
        >
          {dict.subtitle}
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
