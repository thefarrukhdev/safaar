import { Search } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/Input";

export function RestaurantsHero({
  title,
  subtitle,
  query,
  onQueryChange,
  placeholder,
}: {
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (val: string) => void;
  placeholder: string;
}) {
  return (
    <section className="relative flex h-[360px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-900 px-4 text-center">
      {/* Background with overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2070"
          alt="Restaurants"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
      </div>

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="text-lg text-slate-200">{subtitle}</p>
        </div>

        <div className="relative w-full shadow-2xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className="h-14 w-full rounded-2xl border-0 bg-white/95 pl-12 pr-4 text-lg text-slate-900 shadow-inner backdrop-blur-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </section>
  );
}
