"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { CatalogRegion, CatalogCity, CatalogAmenity } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Edit2, Trash2, MapPin, Wifi } from "lucide-react";
import { extractApiErrorMessage } from "@/lib/utils";

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<"regions" | "cities" | "amenities">("regions");
  const [regions, setRegions] = useState<CatalogRegion[]>([]);
  const [amenities, setAmenities] = useState<CatalogAmenity[]>([]);
  const [cities, setCities] = useState<CatalogCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRegion | CatalogCity | CatalogAmenity | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [type, setType] = useState<CatalogAmenity['type']>("hotel");
  const [regionId, setRegionId] = useState("");
  const [amenitiesFilter, setAmenitiesFilter] = useState<CatalogAmenity['type'] | 'all'>('all');

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
    return () => { cancelled = true; };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setIsActive(true);
    setType(amenitiesFilter !== "all" ? amenitiesFilter as CatalogAmenity['type'] : "hotel");
    setRegionId(regions[0]?.id || "");
    setModalOpen(true);
  };

  const openEdit = (item: CatalogRegion | CatalogCity | CatalogAmenity) => {
    setEditing(item);
    setName(item.name);
    setIsActive("isActive" in item ? item.isActive : true);
    if ("regionId" in item) {
      setRegionId(item.regionId);
      setCode("");
      setType("hotel");
    } else if ("code" in item) {
      setCode(item.code);
      setType(item.type);
    } else {
      setCode("");
      setType("hotel");
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Nomini kiriting.");
      return;
    }
    setSaving(true);
    try {
      if (activeTab === "cities") {
        if (!regionId) {
          toast.error("Viloyatni tanlang.");
          setSaving(false);
          return;
        }
        if (editing) {
          await AdminApi.updateCity(editing.id, regionId, trimmedName);
          toast.success("Shahar yangilandi!");
        } else {
          await AdminApi.createCity(regionId, trimmedName);
          toast.success("Shahar qo'shildi!");
        }
      } else if (activeTab === "regions") {
        if (editing) {
          await AdminApi.updateRegion(editing.id, trimmedName, isActive);
          toast.success("Hudud yangilandi!");
        } else {
          await AdminApi.createRegion(trimmedName, isActive);
          toast.success("Hudud qo'shildi!");
        }
      } else {
        if (editing) {
          await AdminApi.updateAmenity(editing.id, trimmedName, isActive);
          toast.success("Qulaylik yangilandi!");
        } else {
          const trimmedCode = code.trim();
          if (!trimmedCode) {
            toast.error("Qulaylik kodini kiriting.");
            setSaving(false);
            return;
          }
          const finalCode = trimmedCode.startsWith(`${type}_`) ? trimmedCode : `${type}_${trimmedCode}`;
          await AdminApi.createAmenity(finalCode, trimmedName, isActive);
          toast.success("Qulaylik qo'shildi!");
        }
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Saqlab bo'lmadi. Qaytadan urinib ko'ring."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: CatalogRegion | CatalogCity | CatalogAmenity) => {
    if (!confirm(`"${item.name}"ni o'chirmoqchimisiz?`)) return;
    setDeletingId(item.id);
    try {
      if (activeTab === "cities") {
        await AdminApi.deleteCity(item.id);
      } else if (activeTab === "regions") {
        await AdminApi.deleteRegion(item.id);
      } else {
        await AdminApi.deleteAmenity(item.id);
      }
      toast.success("O'chirildi!");
      load();
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "O'chirib bo'lmadi."));
    } finally {
      setDeletingId(null);
    }
  };

  const cityColumns: Column<CatalogCity>[] = [
    { key: "id", label: "ID", render: (row) => <span className="text-xs font-mono">{row.id}</span> },
    { key: "name", label: "Shahar nomi", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "region", label: "Viloyat", render: (row) => <span className="text-[var(--text-secondary)]">{regions.find(r => r.id === row.regionId)?.name || "Noma'lum"}</span> },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10" onClick={() => openEdit(row)}>
            <Edit2 size={14} />
          </button>
          <button
            className="w-8 h-8 rounded flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
            disabled={deletingId === row.id}
            onClick={() => handleDelete(row)}
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
    { key: "hotelsCount", label: "Mehmonxonalar soni", render: (row) => <span className="text-[var(--text-secondary)]">{row.hotelsCount} ta</span> },
    {
      key: "isActive",
      label: "Holat",
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${row.isActive ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--text-muted)]/10 text-[var(--text-secondary)]"}`}>
          {row.isActive ? "Faol" : "Nofaol"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10" onClick={() => openEdit(row)}>
            <Edit2 size={14} />
          </button>
          <button
            className="w-8 h-8 rounded flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
            disabled={deletingId === row.id}
            onClick={() => handleDelete(row)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const amenityColumns: Column<CatalogAmenity>[] = [
    { key: "id", label: "ID", render: (row) => <span className="text-xs font-mono">{row.id}</span> },
    { key: "name", label: "Qulaylik nomi", render: (row) => <span className="font-medium">{row.name}</span> },
    { 
      key: "type", 
      label: "Bo'lim", 
      render: (row) => {
        const labels: Record<string, string> = { hotel: "Mehmonxona", room: "Xona", dacha: "Dacha", restaurant: "Restoran", transport: "Transport" };
        return <span className="text-sm text-[var(--text-secondary)]">{labels[row.type] || "Boshqa"}</span>;
      }
    },
    {
      key: "isActive",
      label: "Holat",
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${row.isActive ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--text-muted)]/10 text-[var(--text-secondary)]"}`}>
          {row.isActive ? "Faol" : "Nofaol"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10" onClick={() => openEdit(row)}>
            <Edit2 size={14} />
          </button>
          <button
            className="w-8 h-8 rounded flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
            disabled={deletingId === row.id}
            onClick={() => handleDelete(row)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];



  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div />
        <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          Yangi qo'shish
        </Button>
      </div>

      <div className="flex border-b border-[var(--border)] gap-8">
        <button
          className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "regions" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("regions")}
        >
          <MapPin size={16} />
          Viloyatlar
        </button>
        <button
          className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "cities" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("cities")}
        >
          <MapPin size={16} />
          Shaharlar
        </button>
        <button
          className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "amenities" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("amenities")}
        >
          <Wifi size={16} />
          Qulayliklar
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-4">
        {activeTab === "amenities" && (
          <div className="flex justify-end">
            <select
              className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--primary)]"
              value={amenitiesFilter}
              onChange={(e) => setAmenitiesFilter(e.target.value as CatalogAmenity['type'] | 'all')}
            >
              <option value="all">Barcha bo'limlar</option>
              <option value="hotel">Mehmonxona</option>
              <option value="room">Mehmonxona xonasi</option>
              <option value="dacha">Dacha</option>
              <option value="restaurant">Restoran</option>
              <option value="transport">Transport</option>
            </select>
          </div>
        )}
        {activeTab === "cities" ? (
          <DataTable 
            columns={cityColumns} 
            data={cities} 
            keyField="id" 
            emptyMessage="Shaharlar topilmadi"
            isLoading={loading}
            isError={error}
            onRetry={load}
          />
        ) : activeTab === "regions" ? (
          <DataTable 
            columns={regionColumns} 
            data={regions} 
            keyField="id" 
            emptyMessage="Viloyatlar topilmadi"
            isLoading={loading}
            isError={error}
            onRetry={load}
          />
        ) : (
          <DataTable 
            columns={amenityColumns} 
            data={amenitiesFilter === 'all' ? amenities : amenities.filter(a => a.type === amenitiesFilter)} 
            keyField="id" 
            emptyMessage="Qulayliklar topilmadi"
            isLoading={loading}
            isError={error}
            onRetry={load}
          />
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={
          editing
            ? activeTab === "cities" ? "Shaharni tahrirlash" : activeTab === "regions" ? "Viloyatni tahrirlash" : "Qulaylikni tahrirlash"
            : activeTab === "cities" ? "Yangi shahar" : activeTab === "regions" ? "Yangi viloyat" : "Yangi qulaylik"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saqlanmoqda..." : editing ? "Saqlash" : "Yaratish"}
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
                value={regionId} 
                onChange={(e) => setRegionId(e.target.value)}
              >
                <option value="">Viloyatni tanlang</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
          {activeTab === "amenities" && !editing && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Bo'lim (Turi)</label>
                <select 
                  className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--primary)]"
                  value={type} 
                  onChange={(e) => setType(e.target.value as CatalogAmenity['type'])}
                >
                  <option value="hotel">Mehmonxona</option>
                  <option value="room">Mehmonxona xonasi</option>
                  <option value="dacha">Dacha</option>
                  <option value="restaurant">Restoran</option>
                  <option value="transport">Transport</option>
                </select>
              </div>
              <Input
                label="Kod"
                placeholder="wifi"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </>
          )}
          <Input
            label="Nomi"
            placeholder={activeTab === "cities" ? "Asaka" : activeTab === "regions" ? "Andijon viloyati" : "Wi-Fi"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {activeTab !== "cities" && (
            <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <label htmlFor="isActiveToggle" className="text-sm font-medium cursor-pointer">
              Faol holatda (Hamkorlarga ko'rinadi)
            </label>
          </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
