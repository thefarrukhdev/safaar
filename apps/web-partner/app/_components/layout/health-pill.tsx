"use client";

import { useQuery } from "@tanstack/react-query";
import { health } from "../../_lib/api";

export function HealthPill() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: health.getHealth,
    refetchInterval: 30_000,
    retry: false,
  });
  const online = query.data?.status === "ok";

  return (
    <span
      role="status"
      className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs md:inline-flex dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
    >
      <span className="relative flex h-2 w-2">
        {online && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            online ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
      </span>
      <span>{online ? "Jonli sinxron" : "Qayta ulanmoqda..."}</span>
    </span>
  );
}
