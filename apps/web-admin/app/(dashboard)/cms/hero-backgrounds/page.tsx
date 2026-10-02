"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminHeroBgApi, type HeroBackgroundAdminItem } from "@/lib/api/hero-backgrounds";
import { AdminApi } from "@/lib/api/admin-api";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Edit2, Trash2, Image as ImageIcon, Upload } from "lucide-react";
import Select from "@/components/ui/Select";

export default function HeroBackgroundsPage() {
  const queryClient = useQueryClient();
  const [filterPage, setFilterPage] = useState<string>("all");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HeroBackgroundAdminItem | null>(null);
  
  const [formData, setFormData] = useState<Partial<HeroBackgroundAdminItem>>({
    page: "home",
    imageUrl: "",
    title: { uz: "", ru: "", en: "" },
    subtitle: { uz: "", ru: "", en: "" },
    isActive: true,
    sortOrder: 1,
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "hero-backgrounds", filterPage],
    queryFn: () => adminHeroBgApi.list(filterPage !== "all" ? { page: filterPage } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<HeroBackgroundAdminItem>) => adminHeroBgApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hero-backgrounds"] });
      setModalOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HeroBackgroundAdminItem> }) => adminHeroBgApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hero-backgrounds"] });
      setModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminHeroBgApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hero-backgrounds"] });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string, isActive: boolean }) => adminHeroBgApi.toggleActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hero-backgrounds"] });
    }
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      page: "home",
      imageUrl: "",
      title: { uz: "", ru: "", en: "" },
      subtitle: { uz: "", ru: "", en: "" },
      isActive: true,
      sortOrder: 1,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: HeroBackgroundAdminItem) => {
    setEditingItem(item);
    setFormData({
      page: item.page,
      imageUrl: item.imageUrl,
      title: item.title || { uz: "", ru: "", en: "" },
      subtitle: item.subtitle || { uz: "", ru: "", en: "" },
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Rostdan ham o'chirmoqchimisiz?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { url } = await AdminApi.uploadImage(file);
      setFormData(prev => ({ ...prev, imageUrl: url }));
    } catch (error) {
      alert("Rasm yuklashda xatolik");
    } finally {
      setUploading(false);
    }
  };

  const columns: Column<HeroBackgroundAdminItem>[] = [
    {
      key: "imageUrl",
      label: "Rasm",
      render: (row) => (
        <div className="w-16 h-10 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.page} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-gray-400" />
          )}
        </div>
      ),
    },
    {
      key: "page",
      label: "Sahifa",
      render: (row) => <span className="font-medium capitalize">{row.page}</span>,
    },
    {
      key: "title",
      label: "Sarlavha",
      render: (row) => row.title?.uz || <span className="text-gray-400 italic">Kiritilmagan</span>,
    },
    {
      key: "isActive",
      label: "Holati",
      render: (row) => (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={row.isActive}
            onChange={() => toggleMutation.mutate({ id: row.id, isActive: !row.isActive })}
            disabled={toggleMutation.isPending}
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
        </label>
      ),
    },
    {
      key: "actions",
      label: "Amallar",
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(row)} icon={<Edit2 size={16} />}>{""}</Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)} icon={<Trash2 size={16} className="text-red-500" />}>{""}</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Hero Fon Rasmlari</h1>
          <p className="text-sm text-[var(--text-secondary)]">Saytning asosiy fon rasmlarini boshqarish</p>
        </div>
        <Button onClick={handleOpenCreate} icon={<Plus size={18} />}>
          Yangi qo'shish
        </Button>
      </div>

      <div className="flex gap-4 mb-4">
        <Select
          options={[
            { label: "Barchasi", value: "all" },
            { label: "Bosh sahifa (Home)", value: "home" },
            { label: "Mehmonxonalar (Hotels)", value: "hotels" },
            { label: "Restoranlar (Restaurants)", value: "restaurants" },
            { label: "Transport", value: "transport" },
            { label: "Ko'ngilochar (Attractions)", value: "attractions" },
          ]}
          value={filterPage}
          onChange={(e) => setFilterPage(e.target.value)}
          className="w-64"
        />
      </div>

      <DataTable
        columns={columns}
        data={items}
        keyField="id"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Tahrirlash" : "Yangi fon rasmi qo'shish"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={handleSave}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              Saqlash
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">Sahifa turi</label>
            <Select
              options={[
                { label: "Bosh sahifa (Home)", value: "home" },
                { label: "Mehmonxonalar (Hotels)", value: "hotels" },
                { label: "Restoranlar (Restaurants)", value: "restaurants" },
                { label: "Transport", value: "transport" },
                { label: "Ko'ngilochar (Attractions)", value: "attractions" },
              ]}
              value={formData.page!}
              onChange={(e) => setFormData(prev => ({ ...prev, page: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">Fon rasmi (URL)</label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="https://..."
                value={formData.imageUrl || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
              />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                <Upload size={16} />
              </Button>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>
            {formData.imageUrl && (
              <img src={formData.imageUrl} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-lg border border-gray-200" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 border p-4 rounded-lg bg-gray-50/50">
            <h4 className="font-medium text-sm">Sarlavha (Title)</h4>
            <Input
              label="O'zbekcha"
              value={formData.title?.uz || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, title: { ...prev.title, uz: e.target.value } }))}
            />
            <Input
              label="Ruscha"
              value={formData.title?.ru || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, title: { ...prev.title, ru: e.target.value } }))}
            />
            <Input
              label="Inglizcha"
              value={formData.title?.en || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, title: { ...prev.title, en: e.target.value } }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 border p-4 rounded-lg bg-gray-50/50">
            <h4 className="font-medium text-sm">Tavsif (Subtitle)</h4>
            <Input
              label="O'zbekcha"
              value={formData.subtitle?.uz || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, subtitle: { ...prev.subtitle, uz: e.target.value } }))}
            />
            <Input
              label="Ruscha"
              value={formData.subtitle?.ru || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, subtitle: { ...prev.subtitle, ru: e.target.value } }))}
            />
            <Input
              label="Inglizcha"
              value={formData.subtitle?.en || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, subtitle: { ...prev.subtitle, en: e.target.value } }))}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Faol holatda:</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.isActive || false}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
