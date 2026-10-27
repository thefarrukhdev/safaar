"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { CatalogRegion, CatalogCity, CatalogAmenity } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import {
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Wifi,
  Search,
  Utensils,
  Music,
  Tv,
  Car,
  Coffee,
  Shield,
  Waves,
  Dumbbell,
  Sparkles,
  Wind,
  Baby,
  ShoppingBag,
  Clock,
  Shirt,
  Laptop,
  Accessibility,
  Wine,
  Building2,
  Bed,
  Home,
  Bus,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { extractApiErrorMessage } from "@/lib/utils";

type AmenityCategory = "restaurant" | "hotel" | "room" | "dacha" | "transport";

const CATEGORY_META: Record<
  AmenityCategory,
  { label: string; bg: string; text: string; border: string; icon: typeof Utensils }
> = {
  restaurant: {
    label: "Restoran",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: Utensils,
  },
  hotel: {
    label: "Mehmonxona",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    icon: Building2,
  },
  room: {
    label: "Xona",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800",
    icon: Bed,
  },
  dacha: {
    label: "Dacha",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    icon: Home,
  },
  transport: {
    label: "Transport",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    icon: Bus,
  },
};

const QUICK_ICONS = [
  { id: "Wifi", label: "Wi-Fi", icon: Wifi },
  { id: "Utensils", label: "Taom", icon: Utensils },
  { id: "Music", label: "Musiqa", icon: Music },
  { id: "Wine", label: "Bar", icon: Wine },
  { id: "Car", label: "Parking", icon: Car },
  { id: "Waves", label: "Hovuz", icon: Waves },
  { id: "Wind", label: "Konditsioner", icon: Wind },
  { id: "Coffee", label: "Nonushta", icon: Coffee },
  { id: "Tv", label: "TV", icon: Tv },
  { id: "Dumbbell", label: "Sport", icon: Dumbbell },
  { id: "Sparkles", label: "Spa", icon: Sparkles },
  { id: "Baby", label: "Bolalar", icon: Baby },
  { id: "ShoppingBag", label: "Yetkazish", icon: ShoppingBag },
  { id: "Clock", label: "24/7", icon: Clock },
  { id: "Shield", label: "Xavfsizlik", icon: Shield },
];

function AmenityIcon({
  code,
  icon,
  className = "h-4 w-4",
}: {
  code: string;
  icon?: string;
  className?: string;
}) {
  const c = (icon || code).toLowerCase();
  if (c.includes("wifi")) return <Wifi className={className} />;
  if (
    c.includes("utensil") ||
    c.includes("halal") ||
    c.includes("food") ||
    c.includes("dish") ||
    c.includes("vegan") ||
    c.includes("cater") ||
    c.includes("restaurant") ||
    c.includes("kitchen")
  )
    return <Utensils className={className} />;
  if (c.includes("music") || c.includes("karaoke")) return <Music className={className} />;
  if (c.includes("wine") || c.includes("bar") || c.includes("alcohol") || c.includes("hookah"))
    return <Wine className={className} />;
  if (c.includes("car") || c.includes("parking") || c.includes("shuttle") || c.includes("bus"))
    return <Car className={className} />;
  if (c.includes("pool") || c.includes("wave") || c.includes("jacuzzi"))
    return <Waves className={className} />;
  if (c.includes("coffee") || c.includes("breakfast") || c.includes("dessert"))
    return <Coffee className={className} />;
  if (c.includes("tv")) return <Tv className={className} />;
  if (c.includes("wind") || c.includes("ac") || c.includes("heat")) return <Wind className={className} />;
  if (c.includes("gym") || c.includes("fitness")) return <Dumbbell className={className} />;
  if (c.includes("spa") || c.includes("sauna")) return <Sparkles className={className} />;
  if (c.includes("baby") || c.includes("kid")) return <Baby className={className} />;
  if (c.includes("delivery") || c.includes("takeaway") || c.includes("shop"))
    return <ShoppingBag className={className} />;
  if (
    c.includes("reception") ||
    c.includes("clock") ||
    c.includes("concierge") ||
    c.includes("time") ||
    c.includes("reservation")
  )
    return <Clock className={className} />;
  if (c.includes("laundry") || c.includes("shirt")) return <Shirt className={className} />;
  if (c.includes("workspace") || c.includes("laptop")) return <Laptop className={className} />;
  if (c.includes("wheelchair") || c.includes("access")) return <Accessibility className={className} />;
  if (c.includes("safe") || c.includes("shield") || c.includes("fire") || c.includes("smoke"))
    return <Shield className={className} />;
  return <Sparkles className={className} />;
}

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<"regions" | "cities" | "amenities">("regions");
  const [regions, setRegions] = useState<CatalogRegion[]>([]);
  const [amenities, setAmenities] = useState<CatalogAmenity[]>([]);
  const [cities, setCities] = useState<CatalogCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Viloyat & Shahar modal
  const [regionCityModalOpen, setRegionCityModalOpen] = useState(false);
  const [editingRegionCity, setEditingRegionCity] = useState<CatalogRegion | CatalogCity | null>(null);
  const [regionCityName, setRegionCityName] = useState("");
  const [regionCityIsActive, setRegionCityIsActive] = useState(true);
  const [cityRegionId, setCityRegionId] = useState("");

  // Qulayliklar filtr va qidiruv
  const [amenitySearch, setAmenitySearch] = useState("");
  const [amenityCategoryFilter, setAmenityCategoryFilter] = useState<AmenityCategory | "all">("all");
  const [amenityStatusFilter, setAmenityStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Qulaylik yaratish & tahrirlash modal
  const [amenityModalOpen, setAmenityModalOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<CatalogAmenity | null>(null);
  const [amenityCode, setAmenityCode] = useState("");
  const [amenityNameUz, setAmenityNameUz] = useState("");
  const [amenityNameRu, setAmenityNameRu] = useState("");
  const [amenityNameEn, setAmenityNameEn] = useState("");
  const [amenityCategories, setAmenityCategories] = useState<AmenityCategory[]>(["hotel"]);
  const [amenityIcon, setAmenityIcon] = useState("");
  const [amenityIsActive, setAmenityIsActive] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([AdminApi.getRegions(), AdminApi.getCities(), AdminApi.getAmenities()])
      .then(([reg, cit, amen]) => {
        setRegions(reg);
        setCities(cit);
        setAmenities(amen);
      })
      .catch(() => {
        toast.error("Katalog ma'lumotlarini yuklab bo'lmadi.");
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([AdminApi.getRegions(), AdminApi.getCities(), AdminApi.getAmenities()])
      .then(([reg, cit, amen]) => {
        if (!cancelled) {
          setRegions(reg);
          setCities(cit);
          setAmenities(amen);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Katalog ma'lumotlarini yuklab bo'lmadi.");
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── AMENITY MODAL HANDLERS ───
  const openCreateAmenity = () => {
    setEditingAmenity(null);
    setAmenityCode("");
    setAmenityNameUz("");
    setAmenityNameRu("");
    setAmenityNameEn("");
    setAmenityCategories(
      amenityCategoryFilter !== "all" ? [amenityCategoryFilter] : ["restaurant", "hotel"],
    );
    setAmenityIcon("");
    setAmenityIsActive(true);
    setAmenityModalOpen(true);
  };

  const openEditAmenity = (item: CatalogAmenity) => {
    setEditingAmenity(item);
    setAmenityCode(item.code);
    setAmenityNameUz(item.nameUz || item.name || "");
    setAmenityNameRu(item.nameRu || "");
    setAmenityNameEn(item.nameEn || "");
    setAmenityCategories(
      item.categories && item.categories.length > 0
        ? (item.categories as AmenityCategory[])
        : [(item.type as AmenityCategory) || "hotel"],
    );
    setAmenityIcon(item.icon || "");
    setAmenityIsActive(item.isActive);
    setAmenityModalOpen(true);
  };

  const handleToggleAmenityCategory = (cat: AmenityCategory) => {
    setAmenityCategories((prev) => {
      if (prev.includes(cat)) {
        if (prev.length <= 1) {
          toast.error("Kamida bitta bo'lim tanlangan bo'lishi kerak");
          return prev;
        }
        return prev.filter((c) => c !== cat);
      }
      return [...prev, cat];
    });
  };

  const handleSaveAmenity = async () => {
    const uz = amenityNameUz.trim();
    if (!uz) {
      toast.error("O'zbekcha nomini kiritish majburiy");
      return;
    }

    const code = amenityCode.trim().toLowerCase().replace(/\s+/g, "_");
    if (!code) {
      toast.error("Qulaylik kodi (slug) kiritilishi shart");
      return;
    }

    if (amenityCategories.length === 0) {
      toast.error("Kamida bitta bo'limni tanlang");
      return;
    }

    setSaving(true);
    try {
      const payloadName = {
        uz,
        ru: amenityNameRu.trim() || undefined,
        en: amenityNameEn.trim() || undefined,
        categories: amenityCategories,
        icon: amenityIcon.trim() || undefined,
      };

      if (editingAmenity) {
        await AdminApi.updateAmenity(editingAmenity.id, {
          code,
          name: payloadName,
          isActive: amenityIsActive,
        });
        toast.success(`"${uz}" qulayligi yangilandi!`);
      } else {
        await AdminApi.createAmenity({
          code,
          name: payloadName,
          isActive: amenityIsActive,
        });
        toast.success(`"${uz}" qulayligi qo'shildi!`);
      }

      setAmenityModalOpen(false);
      setEditingAmenity(null);
      load();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Saqlab bo'lmadi. Qaytadan urinib ko'ring."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAmenityActive = async (amenity: CatalogAmenity) => {
    const nextActive = !amenity.isActive;
    try {
      await AdminApi.updateAmenity(amenity.id, { isActive: nextActive });
      setAmenities((prev) =>
        prev.map((a) => (a.id === amenity.id ? { ...a, isActive: nextActive } : a)),
      );
      toast.success(
        nextActive
          ? `"${amenity.name}" faollashtirildi`
          : `"${amenity.name}" nofaol qilindi`,
      );
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Holatni o'zgartirib bo'lmadi"));
    }
  };

  // ─── REGION & CITY HANDLERS ───
  const openCreateRegionCity = () => {
    setEditingRegionCity(null);
    setRegionCityName("");
    setRegionCityIsActive(true);
    setCityRegionId(regions[0]?.id || "");
    setRegionCityModalOpen(true);
  };

  const openEditRegionCity = (item: CatalogRegion | CatalogCity) => {
    setEditingRegionCity(item);
    setRegionCityName(item.name);
    setRegionCityIsActive("isActive" in item ? item.isActive : true);
    if ("regionId" in item) {
      setCityRegionId(item.regionId);
    }
    setRegionCityModalOpen(true);
  };

  const handleSaveRegionCity = async () => {
    const trimmed = regionCityName.trim();
    if (!trimmed) {
      toast.error("Nomini kiriting.");
      return;
    }
    setSaving(true);
    try {
      if (activeTab === "cities") {
        if (!cityRegionId) {
          toast.error("Viloyatni tanlang.");
          setSaving(false);
          return;
        }
        if (editingRegionCity) {
          await AdminApi.updateCity(editingRegionCity.id, cityRegionId, trimmed);
          toast.success("Shahar yangilandi!");
        } else {
          await AdminApi.createCity(cityRegionId, trimmed);
          toast.success("Shahar qo'shildi!");
        }
      } else if (activeTab === "regions") {
        if (editingRegionCity) {
          await AdminApi.updateRegion(editingRegionCity.id, trimmed, regionCityIsActive);
          toast.success("Hudud yangilandi!");
        } else {
          await AdminApi.createRegion(trimmed, regionCityIsActive);
          toast.success("Hudud qo'shildi!");
        }
      }
      setRegionCityModalOpen(false);
      setEditingRegionCity(null);
      load();
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Saqlab bo'lmadi. Qaytadan urinib ko'ring."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (
    item: CatalogRegion | CatalogCity | CatalogAmenity,
    type: "region" | "city" | "amenity",
  ) => {
    if (!confirm(`"${item.name}"ni o'chirmoqchimisiz?`)) return;
    setDeletingId(item.id);
    try {
      if (type === "city") {
        await AdminApi.deleteCity(item.id);
      } else if (type === "region") {
        await AdminApi.deleteRegion(item.id);
      } else {
        await AdminApi.deleteAmenity(item.id);
      }
      toast.success("Muvaffaqiyatli o'chirildi!");
      load();
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "O'chirib bo'lmadi."));
    } finally {
      setDeletingId(null);
    }
  };

  // ─── AMENITY FILTERING & METRICS ───
  const amenityMetrics = useMemo(() => {
    const total = amenities.length;
    const active = amenities.filter((a) => a.isActive).length;
    const restaurantCount = amenities.filter(
      (a) => a.categories?.includes("restaurant") || a.type === "restaurant",
    ).length;
    const hotelCount = amenities.filter(
      (a) => a.categories?.includes("hotel") || a.type === "hotel",
    ).length;
    const dachaCount = amenities.filter(
      (a) => a.categories?.includes("dacha") || a.type === "dacha",
    ).length;
    const transportCount = amenities.filter(
      (a) => a.categories?.includes("transport") || a.type === "transport",
    ).length;

    return { total, active, restaurantCount, hotelCount, dachaCount, transportCount };
  }, [amenities]);

  const filteredAmenities = useMemo(() => {
    return amenities.filter((a) => {
      // Category filter
      if (amenityCategoryFilter !== "all") {
        const cats = a.categories && a.categories.length > 0 ? a.categories : [a.type];
        if (!cats.includes(amenityCategoryFilter)) return false;
      }

      // Status filter
      if (amenityStatusFilter === "active" && !a.isActive) return false;
      if (amenityStatusFilter === "inactive" && a.isActive) return false;

      // Search query
      if (amenitySearch.trim()) {
        const q = amenitySearch.toLowerCase().trim();
        const matchName =
          a.name.toLowerCase().includes(q) ||
          (a.nameUz && a.nameUz.toLowerCase().includes(q)) ||
          (a.nameRu && a.nameRu.toLowerCase().includes(q)) ||
          (a.nameEn && a.nameEn.toLowerCase().includes(q));
        const matchCode = a.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      return true;
    });
  }, [amenities, amenityCategoryFilter, amenityStatusFilter, amenitySearch]);

  // ─── DATA TABLE COLUMNS ───
  const cityColumns: Column<CatalogCity>[] = [
    { key: "id", label: "ID", render: (row) => <span className="text-xs font-mono">{row.id}</span> },
    { key: "name", label: "Shahar nomi", render: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: "region",
      label: "Viloyat",
      render: (row) => (
        <span className="text-[var(--text-secondary)]">
          {regions.find((r) => r.id === row.regionId)?.name || "Noma'lum"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
            onClick={() => openEditRegionCity(row)}
            title="Tahrirlash"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50 transition-colors"
            disabled={deletingId === row.id}
            onClick={() => handleDeleteItem(row, "city")}
            title="O'chirish"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const regionColumns: Column<CatalogRegion>[] = [
    { key: "id", label: "ID", render: (row) => <span className="text-xs font-mono">{row.id}</span> },
    { key: "name", label: "Viloyat / Shahar", render: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: "hotelsCount",
      label: "Mehmonxonalar soni",
      render: (row) => <span className="text-[var(--text-secondary)]">{row.hotelsCount} ta</span>,
    },
    {
      key: "isActive",
      label: "Holat",
      render: (row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            row.isActive
              ? "bg-[var(--success)]/10 text-[var(--success)]"
              : "bg-[var(--text-muted)]/10 text-[var(--text-secondary)]"
          }`}
        >
          {row.isActive ? "Faol" : "Nofaol"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
            onClick={() => openEditRegionCity(row)}
            title="Tahrirlash"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50 transition-colors"
            disabled={deletingId === row.id}
            onClick={() => handleDeleteItem(row, "region")}
            title="O'chirish"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const amenityColumns: Column<CatalogAmenity>[] = [
    {
      key: "icon",
      label: "Belgi",
      className: "w-12 text-center",
      render: (row) => (
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--primary)] shrink-0">
          <AmenityIcon code={row.code} icon={row.icon} className="h-4 w-4" />
        </div>
      ),
    },
    {
      key: "name",
      label: "Qulaylik nomi",
      render: (row) => (
        <div className="flex flex-col py-0.5">
          <span className="font-semibold text-zinc-900 text-sm">
            {row.nameUz || row.name}
          </span>
          {(row.nameRu || row.nameEn) && (
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {row.nameRu ? `RU: ${row.nameRu}` : ""}
              {row.nameRu && row.nameEn ? " · " : ""}
              {row.nameEn ? `EN: ${row.nameEn}` : ""}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "code",
      label: "Kodi",
      render: (row) => (
        <code className="px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-xs font-mono text-zinc-700 border border-[var(--border)]">
          {row.code}
        </code>
      ),
    },
    {
      key: "categories",
      label: "Tegishli bo'limlar",
      render: (row) => {
        const cats =
          row.categories && row.categories.length > 0
            ? (row.categories as AmenityCategory[])
            : [(row.type as AmenityCategory) || "hotel"];

        return (
          <div className="flex flex-wrap gap-1">
            {cats.map((cat) => {
              const meta = CATEGORY_META[cat] || {
                label: cat,
                bg: "bg-zinc-100",
                text: "text-zinc-600",
                border: "border-zinc-200",
              };
              return (
                <span
                  key={cat}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: "isActive",
      label: "Holat",
      render: (row) => (
        <button
          type="button"
          onClick={() => handleToggleAmenityActive(row)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            row.isActive
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 border-zinc-200"
          }`}
          title={row.isActive ? "Nofaol qilish uchun bosing" : "Faollashtirish uchun bosing"}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${row.isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
          />
          {row.isActive ? "Faol" : "Nofaol"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors cursor-pointer"
            onClick={() => openEditAmenity(row)}
            title="Tahrirlash"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50 transition-colors cursor-pointer"
            disabled={deletingId === row.id}
            onClick={() => handleDeleteItem(row, "amenity")}
            title="O'chirish"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-[1250px] mx-auto flex flex-col gap-6 animate-fade-in pb-12">
      {/* ─── TEPADAGI HEADER & QO'SHISH TUGMASI ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Katalog boshqaruvi</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Joylashuvlar (viloyat va shaharlar) hamda platformadagi barcha qulayliklar katalogi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "amenities" ? (
            <Button size="sm" icon={<Plus size={15} />} onClick={openCreateAmenity}>
              Yangi qulaylik qo'shish
            </Button>
          ) : (
            <Button size="sm" icon={<Plus size={15} />} onClick={openCreateRegionCity}>
              {activeTab === "cities" ? "Yangi shahar" : "Yangi viloyat"}
            </Button>
          )}
        </div>
      </div>

      {/* ─── TABS NAVIGATSIYA ─── */}
      <div className="flex border-b border-[var(--border)] gap-8">
        <button
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "regions"
              ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("regions")}
        >
          <MapPin size={16} />
          Viloyatlar ({regions.length})
        </button>
        <button
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "cities"
              ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("cities")}
        >
          <MapPin size={16} />
          Shaharlar ({cities.length})
        </button>
        <button
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "amenities"
              ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("amenities")}
        >
          <Wifi size={16} />
          Qulayliklar ({amenities.length})
        </button>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <div className="flex flex-col gap-5">
        {activeTab === "amenities" ? (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card padding="sm" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">Jami qulayliklar</p>
                  <p className="text-xl font-bold text-zinc-900 mt-0.5">{amenityMetrics.total}</p>
                </div>
              </Card>

              <Card padding="sm" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">Faol qulayliklar</p>
                  <p className="text-xl font-bold text-emerald-600 mt-0.5">{amenityMetrics.active}</p>
                </div>
              </Card>

              <Card padding="sm" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Utensils className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">Restoran bo'limi</p>
                  <p className="text-xl font-bold text-zinc-900 mt-0.5">{amenityMetrics.restaurantCount}</p>
                </div>
              </Card>

              <Card padding="sm" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">Mehmonxona & Xona</p>
                  <p className="text-xl font-bold text-zinc-900 mt-0.5">{amenityMetrics.hotelCount}</p>
                </div>
              </Card>
            </div>

            {/* Filtrlar & Qidiruv paneli */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[var(--border)]">
              {/* Qidiruv */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Nomi yoki kodi bo'yicha qidirish..."
                  value={amenitySearch}
                  onChange={(e) => setAmenitySearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-sm outline-none focus:border-[var(--primary)] focus:bg-white transition-all"
                />
              </div>

              {/* Bo'lim filtri (Pills) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAmenityCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    amenityCategoryFilter === "all"
                      ? "bg-[var(--primary)] text-white shadow-xs"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-zinc-900"
                  }`}
                >
                  Barchasi ({amenities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAmenityCategoryFilter("restaurant")}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    amenityCategoryFilter === "restaurant"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  <Utensils className="h-3.5 w-3.5" />
                  Restoran ({amenityMetrics.restaurantCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAmenityCategoryFilter("hotel")}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    amenityCategoryFilter === "hotel"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Mehmonxona ({amenityMetrics.hotelCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAmenityCategoryFilter("dacha")}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    amenityCategoryFilter === "dacha"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  Dacha ({amenityMetrics.dachaCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAmenityCategoryFilter("transport")}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    amenityCategoryFilter === "transport"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  <Bus className="h-3.5 w-3.5" />
                  Transport ({amenityMetrics.transportCount})
                </button>
              </div>

              {/* Holat filtri */}
              <div className="shrink-0">
                <select
                  className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-xs font-semibold outline-none focus:border-[var(--primary)]"
                  value={amenityStatusFilter}
                  onChange={(e) => setAmenityStatusFilter(e.target.value as "all" | "active" | "inactive")}
                >
                  <option value="all">Barcha holatlar</option>
                  <option value="active">Faqat faol</option>
                  <option value="inactive">Faqat nofaol</option>
                </select>
              </div>
            </div>

            {/* Qulayliklar jadvali */}
            <DataTable
              columns={amenityColumns}
              data={filteredAmenities}
              keyField="id"
              emptyMessage={
                amenitySearch.trim()
                  ? `"${amenitySearch}" bo'yicha hech qanday qulaylik topilmadi`
                  : "Ushbu bo'limda qulayliklar mavjud emas"
              }
              isLoading={loading}
              isError={error}
              onRetry={load}
            />
          </>
        ) : activeTab === "cities" ? (
          <DataTable
            columns={cityColumns}
            data={cities}
            keyField="id"
            emptyMessage="Shaharlar topilmadi"
            isLoading={loading}
            isError={error}
            onRetry={load}
          />
        ) : (
          <DataTable
            columns={regionColumns}
            data={regions}
            keyField="id"
            emptyMessage="Viloyatlar topilmadi"
            isLoading={loading}
            isError={error}
            onRetry={load}
          />
        )}
      </div>

      {/* ─── QULAYLIK QO'SHISH / TAHRIRLASH MODALI ─── */}
      <Modal
        open={amenityModalOpen}
        onClose={() => !saving && setAmenityModalOpen(false)}
        title={
          editingAmenity
            ? `"${editingAmenity.name}" qulayligini tahrirlash`
            : "Yangi qulaylik qo'shish"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAmenityModalOpen(false)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button onClick={handleSaveAmenity} disabled={saving}>
              {saving ? "Saqlanmoqda..." : editingAmenity ? "O'zgarishlarni saqlash" : "Qulaylikni yaratish"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Identifikator / Slug */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Qulaylik kodi (slug) <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="masalan: halal, live_music, delivery"
              value={amenityCode}
              onChange={(e) =>
                setAmenityCode(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                )
              }
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Kichik lotin harflari va pastki chiziq (masalan: <code>halal</code>, <code>vip_room</code>, <code>outdoor_seating</code>)
            </p>
          </div>

          {/* Tegishli bo'limlar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Tegishli bo'limlar (kamida bittasini tanlang) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_META) as AmenityCategory[]).map((cat) => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                const isSelected = amenityCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleAmenityCategory(cat)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-left ${
                      isSelected
                        ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)] ring-1 ring-[var(--primary)]"
                        : "border-[var(--border)] bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ikonka tanlash */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Ikonka belgisi
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]">
              {QUICK_ICONS.map((qi) => {
                const Icon = qi.icon;
                const isSelected = amenityIcon === qi.id;
                return (
                  <button
                    key={qi.id}
                    type="button"
                    onClick={() => setAmenityIcon(qi.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--primary)] text-white shadow-xs"
                        : "bg-white text-zinc-700 border border-[var(--border)] hover:bg-zinc-50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{qi.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nomlar (3 tilda) */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5">
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-brand-600" />
              Nomlar (Ko'p tilli)
            </span>

            <Input
              label="O'zbekcha nomi (majburiy)"
              placeholder="masalan: Halol taomlar"
              value={amenityNameUz}
              onChange={(e) => setAmenityNameUz(e.target.value)}
            />

            <Input
              label="Ruscha nomi (ixtiyoriy)"
              placeholder="masalan: Халяльные блюда"
              value={amenityNameRu}
              onChange={(e) => setAmenityNameRu(e.target.value)}
            />

            <Input
              label="Inglizcha nomi (ixtiyoriy)"
              placeholder="masalan: Halal Food"
              value={amenityNameEn}
              onChange={(e) => setAmenityNameEn(e.target.value)}
            />
          </div>

          {/* Faol holat */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer">
            <input
              type="checkbox"
              id="amenityActiveToggle"
              checked={amenityIsActive}
              onChange={(e) => setAmenityIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-900">
                Faol holatda (Hamkorlar va turistlarga ko'rinadi)
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                O'chirib qo'yilsa, platformadagi filtr va ro'yxatlarda vaqtincha ko'rinmaydi
              </span>
            </div>
          </label>
        </div>
      </Modal>

      {/* ─── VILOYAT VA SHAHAR MODALI ─── */}
      <Modal
        open={regionCityModalOpen}
        onClose={() => !saving && setRegionCityModalOpen(false)}
        title={
          editingRegionCity
            ? activeTab === "cities"
              ? "Shaharni tahrirlash"
              : "Viloyatni tahrirlash"
            : activeTab === "cities"
              ? "Yangi shahar"
              : "Yangi viloyat"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegionCityModalOpen(false)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button onClick={handleSaveRegionCity} disabled={saving}>
              {saving ? "Saqlanmoqda..." : editingRegionCity ? "Saqlash" : "Yaratish"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {activeTab === "cities" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Viloyat</label>
              <select
                className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--primary)]"
                value={cityRegionId}
                onChange={(e) => setCityRegionId(e.target.value)}
              >
                <option value="">Viloyatni tanlang</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Nomi"
            placeholder={activeTab === "cities" ? "Asaka" : "Andijon viloyati"}
            value={regionCityName}
            onChange={(e) => setRegionCityName(e.target.value)}
          />

          {activeTab === "regions" && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="regionActiveToggle"
                checked={regionCityIsActive}
                onChange={(e) => setRegionCityIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <label htmlFor="regionActiveToggle" className="text-sm font-medium cursor-pointer">
                Faol holatda
              </label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
