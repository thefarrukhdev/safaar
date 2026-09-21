import type { HomeDict } from "@/i18n/dictionaries";

export function Hero({
  dict,
  children,
}: {
  dict: HomeDict["hero"];
  children?: React.ReactNode;
  bannerUrl?: string; // kept for backward compat but no longer used
}) {
  return (
    <section className="relative flex min-h-[62vh] md:min-h-[72vh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8f4ff] via-[#dbeafe] to-[#eff6ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* ── Decorative SVG Skyline (same as AccommodationPage banner) ─── */}
      <div className="pointer-events-none absolute inset-0 flex items-end overflow-hidden opacity-30 dark:opacity-20">
        <svg
          viewBox="0 0 1400 320"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          preserveAspectRatio="xMidYMax meet"
        >
          <defs>
            <linearGradient id="heroSkyBlue" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <g fill="url(#heroSkyBlue)">
            {/* FAR LEFT: Small minaret */}
            <rect x="20" y="240" width="30" height="80" rx="2" />
            <path d="M20,240 Q35,220 50,240Z" />
            <rect x="28" y="175" width="14" height="70" rx="1" />
            <path d="M28,175 Q35,158 42,175Z" />
            <ellipse cx="35" cy="153" rx="9" ry="5" />
            <path d="M32,148 L35,138 L38,148Z" />

            {/* LEFT CLUSTER: Mosque with dome */}
            <rect x="62" y="225" width="90" height="95" rx="3" />
            <path d="M62,225 Q107,168 152,225Z" />
            <rect x="98" y="148" width="22" height="80" rx="2" />
            <path d="M98,148 Q109,128 120,148Z" />
            <ellipse cx="109" cy="122" rx="13" ry="18" opacity="0.85" />
            <path d="M106,104 L109,92 L112,104Z" />

            {/* Left tall minaret */}
            <rect x="162" y="130" width="18" height="190" rx="3" />
            <ellipse cx="171" cy="127" rx="11" ry="6" />
            <path d="M162,127 Q171,108 180,127Z" />
            <path d="M168,106 L171,96 L174,106Z" />

            {/* CENTRE MAIN MOSQUE (largest) */}
            <rect x="210" y="248" width="260" height="72" rx="4" />
            <rect x="210" y="225" width="60" height="34" rx="2" />
            <rect x="410" y="225" width="60" height="34" rx="2" />
            {/* arches */}
            <path d="M222,248 Q235,232 248,248Z" />
            <path d="M262,248 Q275,232 288,248Z" />
            <path d="M370,248 Q383,232 396,248Z" />
            <path d="M410,248 Q423,232 436,248Z" />
            {/* Main large dome */}
            <path d="M228,224 Q340,110 452,224Z" />
            <ellipse cx="340" cy="180" rx="20" ry="30" opacity="0.7" />
            {/* Dome finial */}
            <rect x="335" y="108" width="10" height="30" rx="2" />
            <path d="M332,108 L340,92 L348,108Z" />
            <ellipse cx="340" cy="106" rx="7" ry="5" />
            {/* Left main minaret */}
            <rect x="216" y="108" width="22" height="148" rx="3" />
            <ellipse cx="227" cy="105" rx="14" ry="8" />
            <path d="M216,105 Q227,86 238,105Z" />
            <path d="M223,83 L227,70 L231,83Z" />
            {/* Right main minaret */}
            <rect x="442" y="108" width="22" height="148" rx="3" />
            <ellipse cx="453" cy="105" rx="14" ry="8" />
            <path d="M442,105 Q453,86 464,105Z" />
            <path d="M449,83 L453,70 L457,83Z" />

            {/* RIGHT CLUSTER: Medium mosque */}
            <rect x="492" y="232" width="110" height="88" rx="3" />
            <path d="M492,232 Q547,178 602,232Z" />
            <rect x="531" y="160" width="14" height="74" rx="2" />
            <path d="M531,160 Q538,144 545,160Z" />
            <ellipse cx="538" cy="139" rx="9" ry="13" opacity="0.85" />
            <path d="M535,126 L538,115 L541,126Z" />

            {/* Medium minaret right */}
            <rect x="618" y="162" width="18" height="158" rx="2" />
            <ellipse cx="627" cy="160" rx="11" ry="6" />
            <path d="M618,160 Q627,143 636,160Z" />
            <path d="M624,141 L627,131 L630,141Z" />

            {/* Building cluster far right */}
            <rect x="660" y="222" width="85" height="98" rx="3" />
            <path d="M660,222 Q702,186 744,222Z" />
            <rect x="695" y="178" width="14" height="46" rx="2" />
            <path d="M693,178 Q702,165 711,178Z" />
            <path d="M699,163 L702,154 L705,163Z" />

            <rect x="754" y="238" width="60" height="82" rx="2" />
            <path d="M754,238 Q784,212 814,238Z" />
            <rect x="777" y="210" width="12" height="30" rx="1" />
            <path d="M775,210 Q783,199 791,210Z" />

            {/* Far right tapering */}
            <rect x="824" y="248" width="75" height="72" rx="2" />
            <path d="M824,248 Q861,222 898,248Z" />
            <rect x="854" y="222" width="12" height="28" rx="1" />
            <path d="M852,222 Q860,211 868,222Z" />

            <rect x="908" y="255" width="65" height="65" rx="2" />
            <path d="M908,255 Q940,233 972,255Z" />

            <rect x="982" y="262" width="80" height="58" rx="2" />
            <path d="M982,262 Q1022,242 1062,262Z" />

            <rect x="1072" y="258" width="55" height="62" rx="2" />
            <path d="M1072,258 Q1099,238 1126,258Z" />

            <rect x="1136" y="265" width="70" height="55" rx="2" />
            <path d="M1136,265 Q1171,248 1206,265Z" />

            <rect x="1214" y="270" width="90" height="50" rx="2" />
            <path d="M1214,270 Q1259,254 1304,270Z" />

            <rect x="1312" y="275" width="88" height="45" rx="2" />
            <path d="M1312,275 Q1356,260 1400,275Z" />

            {/* Ground fill */}
            <rect x="0" y="318" width="1400" height="8" rx="0" opacity="0.3" />
          </g>
        </svg>
      </div>

      {/* Subtle radial glow in center */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(59,130,246,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(59,130,246,0.08),transparent)]" />

      {/* Hero Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-20 pb-10 text-center sm:px-6 lg:pt-28 lg:pb-14 flex-1 justify-center">
        <h1
          className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl animate-in fade-in zoom-in-95 duration-700 delay-100"
          style={{ fontFamily: "var(--font-manrope, sans-serif)" }}
        >
          {dict.title}
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg md:text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
          {dict.subtitle}
        </p>
      </div>

      {/* SearchBar and CityPills */}
      {children && (
        <div className="relative z-20 mx-auto w-full max-w-5xl px-4 sm:px-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.2,0,0,1)] delay-300">
          {children}
        </div>
      )}
    </section>
  );
}
