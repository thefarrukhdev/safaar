import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  ConciergeBell,
  Megaphone,
  Settings,
  Users,
  BedDouble,
  LifeBuoy,
  Bus,
  Route,
  Ticket,
  UtensilsCrossed,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { getPartnerLabels } from "../../_lib/utils/partner-labels";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Dinamik navigatsiya paneli — hamkor turiga qarab o'zgaradi.
 *
 * Matnlar `partner-labels.ts`dan olinadi — bu yerda ikkinchi, mustaqil
 * terminologiya manbai yaratilmasin.
 */
export function getNavGroups(partnerType: string): NavGroup[] {
  const type = partnerType?.toLowerCase() || "hotel";
  const labels = getPartnerLabels(type);

  // 1. Transport (Avtomobil va Reyslar) hamkorlar uchun navigatsiya
  if (type === "bus") {
    return [
      {
        items: [{ label: "Dispetcherlik", href: "/", icon: ConciergeBell }],
      },
      {
        title: "Sotuv",
        items: [
          { label: "Kompaniya e'loni", href: "/listing", icon: Megaphone },
          { label: "Chegirmalarim", href: "/listing/promotions", icon: Tag }
        ],
      },
      {
        title: "Operatsion",
        items: [
          { label: "Transport Parki", href: "/rooms", icon: Bus },
          { label: "Qatnovlar Jadvali", href: "/calendar", icon: Route },
          { label: "Bronlar va Chiptalar", href: "/reservations", icon: Ticket },
        ],
      },
      {
        title: "Mijozlar",
        items: [{ label: "Yo'lovchilar / Mijozlar", href: "/guests", icon: Users }],
      },
      {
        title: "Boshqaruv",
        items: [
          { label: "Hisobotlar", href: "/reports", icon: BarChart3 },
          { label: "Sozlamalar", href: "/settings/hotel", icon: Settings },
          { label: "Yordam", href: "/support", icon: LifeBuoy },
        ],
      },
    ];
  }

  // 2. Dacha hamkorlar uchun navigatsiya (xonalar shart emas, dacha o'zi bitta xona)
  if (type === "dacha") {
    return [
      {
        items: [{ label: labels.dashboardTitle, href: "/", icon: ConciergeBell }],
      },
      {
        title: "Sotuv",
        items: [
          { label: labels.listingTitle, href: "/listing", icon: Megaphone },
          { label: "Chegirmalarim", href: "/listing/promotions", icon: Tag }
        ],
      },
      {
        title: "Operatsion",
        items: [
          { label: labels.unitsPageTitle, href: "/rooms", icon: BedDouble },
          { label: labels.calendarTitle, href: "/calendar", icon: CalendarDays },
          { label: labels.reservationsTitle, href: "/reservations", icon: CalendarRange },
        ],
      },
      {
        title: "Mijoz",
        items: [{ label: "Mijozlar", href: "/guests", icon: Users }],
      },
      {
        title: "Boshqaruv",
        items: [
          { label: "Hisobotlar", href: "/reports", icon: BarChart3 },
          { label: "Sozlamalar", href: "/settings/hotel", icon: Settings },
          { label: "Yordam", href: "/support", icon: LifeBuoy },
        ],
      },
    ];
  }

  // 3. Hostel uchun navigatsiya
  if (type === "hostel") {
    return [
      {
        items: [{ label: labels.dashboardTitle, href: "/", icon: ConciergeBell }],
      },
      {
        title: "Sotuv",
        items: [
          { label: labels.listingTitle, href: "/listing", icon: Megaphone },
          { label: "Chegirmalarim", href: "/listing/promotions", icon: Tag }
        ],
      },
      {
        title: "Operatsion",
        items: [
          { label: capitalize(labels.unitPlural), href: "/rooms", icon: BedDouble },
          { label: labels.reservationsTitle, href: "/reservations", icon: CalendarRange },
          { label: "Kalendar", href: "/calendar", icon: CalendarDays },
        ],
      },
      {
        title: "Mijoz",
        items: [{ label: "Mijozlar", href: "/guests", icon: Users }],
      },
      {
        title: "Boshqaruv",
        items: [
          { label: "Hisobotlar", href: "/reports", icon: BarChart3 },
          { label: "Sozlamalar", href: "/settings/hotel", icon: Settings },
          { label: "Yordam", href: "/support", icon: LifeBuoy },
        ],
      },
    ];
  }

  // 4. Restoran uchun navigatsiya
  if (type === "restaurant") {
    return [
      {
        items: [{ label: labels.dashboardTitle, href: "/", icon: ConciergeBell }],
      },
      {
        title: "Sotuv",
        items: [
          { label: labels.listingTitle, href: "/listing", icon: Megaphone },
          { label: "Chegirmalarim", href: "/listing/promotions", icon: Tag }
        ],
      },
      {
        title: "Operatsion",
        items: [
          { label: capitalize(labels.unitPlural), href: "/rooms", icon: UtensilsCrossed },
          { label: labels.reservationsTitle, href: "/reservations", icon: CalendarRange },
          { label: "Kalendar", href: "/calendar", icon: CalendarDays },
        ],
      },
      {
        title: "Mijoz",
        items: [{ label: "Mijozlar", href: "/guests", icon: Users }],
      },
      {
        title: "Boshqaruv",
        items: [
          { label: "Hisobotlar", href: "/reports", icon: BarChart3 },
          { label: "Sozlamalar", href: "/settings/hotel", icon: Settings },
          { label: "Yordam", href: "/support", icon: LifeBuoy },
        ],
      },
    ];
  }

  // 5. Standart / Mehmonxona (Hotel, Motel, Guesthouse)
  return [
    {
      items: [{ label: labels.dashboardTitle, href: "/", icon: ConciergeBell }],
    },
    {
      title: "Sotuv",
      items: [
        { label: labels.listingTitle, href: "/listing", icon: Megaphone },
        { label: "Chegirmalarim", href: "/listing/promotions", icon: Tag }
      ],
    },
    {
      title: "Operatsion",
      items: [
        { label: capitalize(labels.unitPlural), href: "/rooms", icon: BedDouble },
        { label: labels.reservationsTitle, href: "/reservations", icon: CalendarRange },
        { label: "Kalendar", href: "/calendar", icon: CalendarDays },
      ],
    },
    {
      title: "Mijoz",
      items: [{ label: "Mijozlar", href: "/guests", icon: Users }],
    },
    {
      title: "Boshqaruv",
      items: [
        { label: "Hisobotlar", href: "/reports", icon: BarChart3 },
        { label: "Sozlamalar", href: "/settings/hotel", icon: Settings },
        { label: "Yordam", href: "/support", icon: LifeBuoy },
      ],
    },
  ];
}
