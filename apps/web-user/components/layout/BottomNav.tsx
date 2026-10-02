"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, CalendarCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

export interface BottomNavProps {
 locale: string;
 dict: any;
}

export function BottomNav({ locale, dict }: BottomNavProps) {
 const pathname = usePathname();

 const tabs = [
 {
 name: dict.nav.search,
 icon: Search,
 href: `/${locale}`,
 exact: true,
 },
 {
 name: dict.nav.favorites,
 icon: Heart,
 href: `/${locale}/account/favorites`,
 },
 {
 name: dict.nav.bookings,
 icon: CalendarCheck,
 href: `/${locale}/account/bookings`,
 },
 {
 name: dict.nav.profile,
 icon: UserRound,
 href: `/${locale}/account`,
 },
 ];

 const checkIsActive = (href: string, exact?: boolean) => {
 if (!pathname) return false;

 if (exact || href === `/${locale}`) {
 return pathname === href || pathname === `${href}/`;
 }

 if (href === `/${locale}/account`) {
 const isFavorites =
 pathname === `/${locale}/account/favorites` ||
 pathname.startsWith(`/${locale}/account/favorites/`);
 const isBookings =
 pathname === `/${locale}/account/bookings` ||
 pathname.startsWith(`/${locale}/account/bookings/`);
 if (isFavorites || isBookings) return false;
 return pathname === href || pathname.startsWith(`${href}/`);
 }

 return pathname === href || pathname.startsWith(`${href}/`);
 };

 return (
 <nav
 aria-label="Mobil navigatsiya"
 className="fixed bottom-0 inset-x-0 z-50 h-16 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
 >
 <div className="grid h-full grid-cols-4 items-center">
 {tabs.map((tab) => {
 const isActive = checkIsActive(tab.href, tab.exact);
 const Icon = tab.icon;

 return (
 <Link
 key={tab.href}
 href={tab.href}
 aria-current={isActive ? "page" : undefined}
 className={cn(
 "flex h-full flex-col items-center justify-center gap-1 transition-colors",
 isActive ? "text-blue-600" : "text-slate-400"
 )}
 >
 <div className="relative flex items-center justify-center">
 {isActive && (
 <span
 aria-hidden="true"
 className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-600"
 />
 )}
 <Icon className="h-5 w-5" />
 </div>
 <span className="text-[10px] font-semibold leading-none">{tab.name}</span>
 </Link>
 );
 })}
 </div>
 </nav>
 );
}

export default BottomNav;
