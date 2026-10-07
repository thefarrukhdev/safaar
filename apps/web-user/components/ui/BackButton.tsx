"use client";

import { useRouter } from"next/navigation";
import { ArrowLeft } from"lucide-react";
import { cn } from"@/lib/cn";
import { Button } from"@/components/ui/Button";

interface Props {
 href?: string;
 className?: string;
}

export function BackButton({ href, className }: Props) {
 const router = useRouter();

 function handleClick() {
 if (href) {
 router.push(href);
 } else if (window.history.length > 1) {
 router.back();
 } else {
 router.push("/");
 }
 }

 return (
 <Button
 type="button"
 variant="secondary"
 size="sm"
 onClick={handleClick}
 aria-label="Orqaga"
 className={cn(
"h-9 w-9 min-h-0 !p-0 flex items-center justify-center border border-slate-200 hover:border-slate-350",
 className,
 )}
 >
 <ArrowLeft className="h-5 w-5 text-slate-700"strokeWidth={2.5} aria-hidden />
 </Button>
 );
}
