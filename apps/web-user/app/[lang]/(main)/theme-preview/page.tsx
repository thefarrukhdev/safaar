import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";

/**
 * Tema oldindan ko'rish sahifasi — FAQAT LOCAL DEV uchun.
 * Production'da 404 qaytaradi.
 */

// Production'da bu sahifani yashiramiz
if (process.env.NODE_ENV === "production") {
  // module level check — build time da bu sahifani dead-code qilamiz
}

interface ThemeConfig {
  name: string;
  description: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  textSecondary: string;
}

const themes: ThemeConfig[] = [
  {
    name: "Toza Yashil",
    description: "Ishonchli, tabiat, travel classic",
    primary: "#059669",
    primaryHover: "#047857",
    primaryLight: "#ecfdf5",
    accent: "#D97706",
    bg: "#FFFFFF",
    surface: "#F8FAFC",
    text: "#1E293B",
    textSecondary: "#64748B",
  },
  {
    name: "Ko'k Osmon",
    description: "Booking/Trip.com professional uslubi",
    primary: "#1D4ED8",
    primaryHover: "#1E40AF",
    primaryLight: "#EFF6FF",
    accent: "#EA580C",
    bg: "#FFFFFF",
    surface: "#F1F5F9",
    text: "#0F172A",
    textSecondary: "#475569",
  },
  {
    name: "Minimalist Qora",
    description: "Apple/Uber premium, ultra toza",
    primary: "#18181B",
    primaryHover: "#27272A",
    primaryLight: "#F4F4F5",
    accent: "#4F46E5",
    bg: "#FFFFFF",
    surface: "#FAFAFA",
    text: "#09090B",
    textSecondary: "#71717A",
  },
  {
    name: "Issiq Sariq",
    description: "O'zbekiston quyoshi, mehmon do'stligi",
    primary: "#D97706",
    primaryHover: "#B45309",
    primaryLight: "#FFFBEB",
    accent: "#0D9488",
    bg: "#FFFBEB",
    surface: "#FEF3C7",
    text: "#1C1917",
    textSecondary: "#78716C",
  },
];

function ThemeCard({ theme }: { theme: ThemeConfig }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border shadow-sm"
      style={{ backgroundColor: theme.bg }}
    >
      {/* Mini navbar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ backgroundColor: theme.surface }}
      >
        <span
          className="text-lg font-bold"
          style={{ color: theme.primary }}
        >
          Safaar
        </span>
        <div className="flex gap-3 text-sm" style={{ color: theme.textSecondary }}>
          <span>Hotels</span>
          <span>Transport</span>
          <span>Attractions</span>
        </div>
        <button
          className="rounded-full px-4 py-1.5 text-sm font-medium text-white"
          style={{ backgroundColor: theme.primary }}
        >
          Kirish
        </button>
      </div>

      {/* Hero area */}
      <div
        className="px-5 py-8"
        style={{ backgroundColor: theme.primaryLight }}
      >
        <h3
          className="text-xl font-bold"
          style={{ color: theme.text }}
        >
          O&apos;zbekistonni kashf eting
        </h3>
        <p
          className="mt-1 text-sm"
          style={{ color: theme.textSecondary }}
        >
          Mehmonxona va transport — bir joyda
        </p>
        {/* Search bar preview */}
        <div
          className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-3"
          style={{ backgroundColor: theme.bg, borderColor: theme.primaryLight }}
        >
          <span className="flex-1 text-sm" style={{ color: theme.textSecondary }}>
            Qayerga borasiz?
          </span>
          <button
            className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: theme.primary }}
          >
            Qidirish
          </button>
        </div>
      </div>

      {/* Cards area */}
      <div className="flex gap-3 px-5 py-5">
        {["Toshkent", "Samarqand", "Buxoro"].map((city) => (
          <div
            key={city}
            className="flex-1 rounded-xl border p-3"
            style={{ backgroundColor: theme.surface }}
          >
            <div
              className="mb-2 h-16 rounded-lg"
              style={{ backgroundColor: theme.primaryLight }}
            />
            <p className="text-sm font-medium" style={{ color: theme.text }}>
              {city}
            </p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              120 000 so&apos;m
            </p>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <div className="flex gap-3 px-5 pb-5">
        <button
          className="flex-1 rounded-xl py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: theme.primary }}
        >
          Bron qilish
        </button>
        <button
          className="flex-1 rounded-xl py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: theme.accent }}
        >
          Batafsil
        </button>
      </div>

      {/* Theme name */}
      <div
        className="border-t px-5 py-3 text-center"
        style={{ backgroundColor: theme.surface }}
      >
        <p className="text-base font-bold" style={{ color: theme.text }}>
          {theme.name}
        </p>
        <p className="text-xs" style={{ color: theme.textSecondary }}>
          {theme.description}
        </p>
      </div>
    </div>
  );
}

export default async function ThemePreviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  // Production'da bu sahifa ommaga ko'rinmasin
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900">
          Rang palitrasi tanlash
        </h1>
        <p className="mt-2 text-slate-600">
          Qaysi variant yoqadi? Tanlang — qolganini o&apos;chiramiz.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {themes.map((theme) => (
          <ThemeCard key={theme.name} theme={theme} />
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-600">
          💡 Shu sahifani <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">localhost:3000/uz/theme-preview</code> da oching.
          <br />
          Tanlangandan keyin bu sahifa o&apos;chiriladi.
        </p>
      </div>
    </main>
  );
}
