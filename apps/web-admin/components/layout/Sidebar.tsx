"use client";

import { cn } from "@/lib/utils";
import { SIDEBAR_ITEMS, type NavItem } from "@/lib/constants";
import { AdminApi, type AdminNotificationSummary } from "@/lib/api/admin-api";
import { useAuthStore } from "@/lib/store/auth";
import SidebarItem from "./SidebarItem";
import {
  LayoutDashboard, Users, Building2, CalendarCheck, Wallet, PanelsTopLeft,
  MapPin, Ticket, MessageCircle, Settings, ScrollText, FileText, List,
  Hotel, Bus, BarChart3, ArrowDownToLine, FileSpreadsheet, ImageIcon, Tag,
  Newspaper, Mail, Settings2, CreditCard, Send, ShieldCheck,
  ChevronLeft, History, UtensilsCrossed
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const ICON_MAP: Record<string, ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={18} />,
  Users: <Users size={18} />,
  Building2: <Building2 size={18} />,
  CalendarCheck: <CalendarCheck size={18} />,
  Wallet: <Wallet size={18} />,
  PanelsTopLeft: <PanelsTopLeft size={18} />,
  MapPin: <MapPin size={18} />,
  Ticket: <Ticket size={18} />,
  MessageCircle: <MessageCircle size={18} />,
  Settings: <Settings size={18} />,
  ScrollText: <ScrollText size={18} />,
  FileText: <FileText size={16} />,
  List: <List size={16} />,
  Hotel: <Hotel size={16} />,
  Bus: <Bus size={16} />,
  BarChart3: <BarChart3 size={16} />,
  ArrowDownToLine: <ArrowDownToLine size={16} />,
  FileSpreadsheet: <FileSpreadsheet size={16} />,
  Image: <ImageIcon size={16} />,
  Tag: <Tag size={16} />,
  Newspaper: <Newspaper size={16} />,
  Mail: <Mail size={16} />,
  Settings2: <Settings2 size={16} />,
  CreditCard: <CreditCard size={16} />,
  Send: <Send size={16} />,
  ShieldCheck: <ShieldCheck size={16} />,
  History: <History size={18} />,
  UtensilsCrossed: <UtensilsCrossed size={16} />,
};

function getIcon(name: string): ReactNode {
  return ICON_MAP[name] ?? <LayoutDashboard size={18} />;
}

function badgeForItem(
  href: string,
  summary: AdminNotificationSummary | null,
): number | undefined {
  if (!summary) return undefined;
  if (href === "/partners" || href === "/partners/requests") {
    return summary.partnerRequests;
  }
  if (href === "/support") {
    return summary.supportOpen;
  }
  return undefined;
}

function applyLiveBadges(
  item: NavItem,
  summary: AdminNotificationSummary | null,
): NavItem {
  return {
    ...item,
    badge: badgeForItem(item.href, summary),
    children: item.children?.map((child) => applyLiveBadges(child, summary)),
  };
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<AdminNotificationSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = () => {
      AdminApi.getNotificationSummary()
        .then((nextSummary) => {
          if (!cancelled) setSummary(nextSummary);
        })
        .catch((error) => {
          console.error("Failed to load sidebar notification summary", error);
        });
    };

    const initialTimeoutId = window.setTimeout(loadSummary, 0);
    const intervalId = window.setInterval(loadSummary, 30_000);
    window.addEventListener("focus", loadSummary);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadSummary);
    };
  }, [pathname]);

  const { user } = useAuthStore();

  const sidebarItems = useMemo(() => {
    let items = SIDEBAR_ITEMS;
    if (user?.role === "FINANCE") {
      items = items.filter(item => ["Moliya", "Audit jurnali", "Bosh panel"].includes(item.label));
    } else if (user?.role === "SUPPORT") {
      items = items.filter(item => ["Bosh panel", "Foydalanuvchilar", "Hamkorlar", "Bronlar", "Yordam"].includes(item.label));
    } else if (user?.role === "CONTENT") {
      items = items.filter(item => ["Bosh panel", "Kontent (CMS)", "Promo-kodlar", "Katalog"].includes(item.label));
      
      // Also update the nested items for CONTENT role if necessary
      // though the filter above only filters top-level items.
    }
    return items.map((item) => applyLiveBadges(item, summary));
  }, [summary, user?.role]);

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-screen flex flex-col z-30",
        "bg-[var(--sidebar-bg)] transition-all duration-300 ease-in-out",
        collapsed ? "w-[var(--sidebar-collapsed)]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] flex items-center justify-center text-white font-bold text-sm shrink-0">
            UB
          </div>
          {!collapsed && (
            <div className="flex flex-col animate-fade-in">
              <span className="text-white font-bold text-base tracking-tight">Safaar</span>
              <span className="text-[var(--sidebar-text)] text-[10px] uppercase tracking-widest">Admin Panel</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-0.5">
        {sidebarItems.map((item) => (
          <SidebarItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={getIcon(item.icon)}
            badge={item.badge}
            collapsed={collapsed}
            subItems={item.children?.map((child) => ({
              ...child,
              icon: getIcon(child.icon),
            }))}
          />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-white/8 p-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[var(--sidebar-text)] hover:text-white hover:bg-[var(--sidebar-hover)] transition-all duration-150 text-sm cursor-pointer"
        >
          <ChevronLeft
            size={16}
            className={cn("transition-transform duration-300", collapsed && "rotate-180")}
          />
          {!collapsed && <span>Yig&apos;ish</span>}
        </button>
      </div>
    </aside>
  );
}
