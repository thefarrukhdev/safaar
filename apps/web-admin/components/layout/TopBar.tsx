"use client";

import { Bell, LogOut, User, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { useAuthStore } from "@/lib/store/auth";
import { useNotificationsStore } from "@/lib/store/notifications";
import { AdminApi } from "@/lib/api/admin-api";
import { formatDistanceToNow } from "date-fns";
import { uz } from "date-fns/locale";

export default function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { items: notifications, unreadCount, setNotifications, markAsRead, markAllAsRead } = useNotificationsStore();
  
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  
  const profileRef = useRef<HTMLDivElement>(null);
  const notifsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadNotifications = () => {
      AdminApi.getNotifications()
        .then((nextNotifications) => {
          if (!cancelled) setNotifications(nextNotifications);
        })
        .catch((error) => {
          console.error("Failed to load admin notifications", error);
        });
    };

    const initialTimeoutId = window.setTimeout(loadNotifications, 0);
    const intervalId = window.setInterval(loadNotifications, 30_000);
    window.addEventListener("focus", loadNotifications);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadNotifications);
    };
  }, [setNotifications]);

  const handleLogout = () => {
    logout();
    Cookies.remove("admin_token");
    router.push("/login");
  };

  const displayName = user?.name || "Admin";
  const displayEmail = user?.email || "admin@safaar.uz";
  const displayRole = user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
  const initials = displayName.trim().split(/\s+/).filter(Boolean).map((n: string) => n[0]).join("").substring(0, 2);

  const pathname = usePathname();

  const getPageInfo = () => {
    const PAGE_INFO: Record<string, { title: string; desc: string }> = {
      "/dashboard": { title: "Bosh panel", desc: "Platformaning umumiy ko'rsatkichlari va statistikasi" },
      "/users": { title: "Foydalanuvchilar", desc: "Mijozlar ro'yxati va ularning ma'lumotlarini boshqarish" },
      "/partners/list": { title: "Hamkorlar ro'yxati", desc: "Tizimdagi barcha mehmonxona va mashina ijarasi hamkorlari" },
      "/partners/requests": { title: "Yangi so'rovlar", desc: "Hamkorlik uchun kelib tushgan arizalar" },
      "/support": { title: "Yordam va Murojaatlar", desc: "Foydalanuvchilar va hamkorlardan kelgan xabarlar (Tickets)" },
      "/finance/overview": { title: "Moliyaviy ko'rsatkichlar", desc: "Kirim, chiqim va umumiy statistika" },
      "/finance/withdrawals": { title: "To'lov so'rovlari", desc: "Hamkorlar tomonidan mablag' yechish so'rovlari" },
      "/finance/reports": { title: "Soliq va Hisobotlar", desc: "Soliq hisobotlari va daromad tahlili" },
      "/cms/banners": { title: "Bannerlar", desc: "Bosh sahifa bannerlarini boshqarish" },
      "/cms/deals": { title: "Chegirmali Takliflar", desc: "Chegirma va aksiyalarni boshqarish" },
      "/cms/featured-hotels": { title: "Mashhur Takliflar", desc: "Bosh sahifadagi mashhur mehmonxonalar" },
      "/cms/pages": { title: "Sayt Sahifalari", desc: "Statik sahifalar va kontentni boshqarish" },
      "/cms/news": { title: "Yangiliklar", desc: "Blog va yangiliklar xabarlari" },
      "/promos": { title: "Promo-kodlar", desc: "Chegirma kodlari va ularni boshqarish" },
      "/settings": { title: "Global Sozlamalar", desc: "Tizimning umumiy parametrlari" },
      "/catalog": { title: "Katalog", desc: "Joylashuv va qulayliklar katalogi" },
      "/audit": { title: "Harakatlar tarixi", desc: "Tizimdagi barcha amallar jurnali" },
      "/bookings/hotels": { title: "Mehmonxona bronlari", desc: "Barcha mehmonxona buyurtmalari ro'yxati" },
      "/bookings/buses": { title: "Ijara bronlari", desc: "Barcha mashina ijarasi buyurtmalari" },
    };
    
    // Sort keys by length descending to match most specific paths first
    const sortedPaths = Object.keys(PAGE_INFO).sort((a, b) => b.length - a.length);
    const matchedPath = sortedPaths.find(path => pathname?.startsWith(path));
    
    return matchedPath ? PAGE_INFO[matchedPath] : { title: "", desc: "" };
  };

  const pageInfo = getPageInfo();

  const handleMarkAsRead = async (id: string) => {
    await AdminApi.markNotificationRead(id);
    markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await AdminApi.markAllNotificationsRead();
    markAllAsRead();
  };

  return (
    <header className="h-16 bg-white border-b border-[var(--border)] flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
      {/* Left section: Page Title */}
      <div className="flex flex-col">
        {pageInfo.title && <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight tracking-tight">{pageInfo.title}</h1>}
        {pageInfo.desc && <p className="text-xs text-[var(--text-muted)] mt-0.5">{pageInfo.desc}</p>}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifsRef}>
          <button 
            onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[var(--danger)] ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifs Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[var(--border)] shadow-lg py-2 animate-scale-in z-50">
              <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Bildirishnomalar</p>
                <div className="flex gap-2">
                  <button onClick={() => void handleMarkAllAsRead()} className="text-xs text-[var(--primary)] hover:underline cursor-pointer" title="Barchasini o'qildi qilish">
                    <Check size={14} />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-center py-4 text-[var(--text-muted)]">Bildirishnomalar yo'q</p>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`px-4 py-3 border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/50' : ''}`}
                      onClick={() => void handleMarkAsRead(n.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{n.title}</p>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-[var(--primary)] mt-1" />}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-1">{n.message}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: uz })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-[var(--border)] mx-2" />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
            className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-light)] flex items-center justify-center text-white text-xs font-bold uppercase">
              {initials}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] leading-tight">
                {displayRole}
              </span>
            </div>
          </button>

          {/* Dropdown */}
          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-[var(--border)] shadow-lg py-2 animate-scale-in z-50">
              <div className="px-4 py-2 border-b border-[var(--border)]">
                <p className="text-sm font-medium text-[var(--text-primary)]">{displayName}</p>
                <p className="text-xs text-[var(--text-muted)]">{displayEmail}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfile(false);
                    router.push("/settings");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                >
                  <User size={16} />
                  Profil sozlamalari
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--danger)] hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  Chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
