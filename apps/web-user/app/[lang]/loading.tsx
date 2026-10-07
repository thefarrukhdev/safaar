import { ThinkingOrb } from "@/components/ui/thinking-orb";

export default function GlobalLoading() {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
 <div className="flex flex-col items-center gap-6">
 <ThinkingOrb size={160} state="base" className="text-blue-600" style={{ color: "#2563eb" }} />
 <p className="text-sm font-medium text-slate-500 animate-pulse tracking-wide">
 Yuklanmoqda...
 </p>
 </div>
 </div>
 );
}
