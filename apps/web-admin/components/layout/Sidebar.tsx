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
  ChevronLeft, History, UtensilsCrossed, Star, Languages, Search
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
  Star: <Star size={18} />,
  Languages: <Languages size={16} />,
  Search: <Search size={16} />,
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

/**
 * 2026-09-14 SAFAAR admin gap closure — sidebar visibility now reflects
 * the REAL backend permission a role has (`common/permissions.ts`
 * `rolePermissions`, fetched via GET /admin/roles), not a second,
 * hand-maintained list. This is UX only — hiding a link is never the
 * security boundary, the backend guard is (see RolesGuard); a role that
 * can't see "Moliya" here still gets 403 if it calls the API directly.
 * Only sections with an unambiguous 1:1 backend permission are gated;
 * everything else (catalog/promos/settings/developer) stays visible to
 * every admin rather than risk hiding something a role legitimately needs.
 */
const NAV_PERMISSION_BY_HREF: Record<string, string> = {
  "/users": "users:read",
  "/team": "admins:read",
  "/partners": "partners:read",
  "/partners/requests": "partners:read",
  "/partners/list": "partners:read",
  "/partners/listings": "partners:read",
  "/bookings": "bookings:read",
  "/bookings/hotels": "bookings:read",
  "/bookings/restaurants": "bookings:read",
  "/bookings/buses": "bookings:read",
  "/finance": "finance:read",
  "/finance/overview": "finance:read",
  "/finance/payments": "finance:read",
  "/finance/refunds": "finance:read",
  "/finance/withdrawals": "finance:read",
  "/finance/reports": "finance:read",
  "/cms": "cms:read",
  "/cms/banners": "cms:read",
  "/cms/destinations": "cms:read",
  "/cms/offers": "cms:read",
  "/cms/news": "cms:read",
  "/cms/pages": "cms:read",
  "/cms/templates": "cms:read",
  "/cms/broadcasts": "cms:read",
  "/cms/translations": "translations:read",
  "/cms/seo": "seo:read",
  "/reviews": "reviews:read",
  "/support": "support:read",
  "/audit": "audit-logs:read",
};

function filterByPermission(
  items: NavItem[],
  granted: Set<string> | null,
): NavItem[] {
  // granted === null -> ruxsatlar hali yuklanmagan (yoki SUPER_ADMIN,
  // fetch shart emas) -> hech narsa yashirilmaydi (fail-open UX; real
  // himoya baribir backendda).
  if (!granted) return items;
  return items.flatMap((item) => {
    const required = NAV_PERMISSION_BY_HREF[item.href];
    if (required && !granted.has(required)) return [];
    const children = item.children
      ? filterByPermission(item.children, granted)
      : undefined;
    if (item.children && children && children.length === 0) return [];
    return [{ ...item, children }];
  });
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<AdminNotificationSummary | null>(null);
  const currentRole = useAuthStore((state) => state.user?.role);
  const [grantedPermissions, setGrantedPermissions] = useState<Set<string> | null>(
    null,
  );

  useEffect(() => {
    const load = () => {
      if (!currentRole || currentRole === "SUPER_ADMIN") {
        // SUPER_ADMIN har doim hamma narsani ko'radi — sorov shart emas.
        setGrantedPermissions(null);
        return;
      }
      AdminApi.getRoles()
        .then((roles) => {
          const match = roles.find((r) => r.id.toUpperCase() === currentRole);
          setGrantedPermissions(match ? new Set(match.permissions) : null);
        })
        .catch((error) => {
          console.error("Failed to load role permission matrix", error);
          setGrantedPermissions(null);
        });
    };
    load();
  }, [currentRole]);

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

  // develop independently added a hardcoded role-based filter here
  // (FINANCE/SUPPORT/CONTENT — the same wrong, non-"_ADMIN" role names
  // fixed in lib/store/auth.ts and types/admin.ts) as a coarser
  // alternative to this. Kept the granular permission-based filter:
  // it's driven by the real backend permissions map (GET /admin/roles)
  // rather than a hardcoded role/label list, so it can't silently drift
  // from what RolesGuard actually enforces.
  const sidebarItems = useMemo(
    () =>
      filterByPermission(SIDEBAR_ITEMS, grantedPermissions).map((item) =>
        applyLiveBadges(item, summary),
      ),
    [summary, grantedPermissions],
  );

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
