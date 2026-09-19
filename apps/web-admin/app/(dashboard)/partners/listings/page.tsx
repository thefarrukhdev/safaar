"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AdminListing } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import { Eye } from "lucide-react";
import { useAdminStore } from "@/lib/store";
import Link from "next/link";
import { AdminApi } from "@/lib/api/admin-api";
import { extractApiErrorMessage } from "@/lib/utils";

const LISTING_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  under_review: { label: "Ko'rib chiqilmoqda", color: "#F39C12", bg: "rgba(243,156,18,0.12)" },
  published: { label: "Nashr qilingan", color: "#2ECC71", bg: "rgba(46,204,113,0.12)" },
  rejected: { label: "Rad etilgan", color: "#E74C3C", bg: "rgba(231,76,60,0.12)" },
};

export default function PartnerListingsPage() {
  const listings = useAdminStore((s) => s.listings);
  const setListings = useAdminStore((s) => s.setListings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchListings = () => {
    setLoading(true);
    setError(false);
    AdminApi.getListings()
      .then((items) => setListings(items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      setError(false);
      AdminApi.getListings()
        .then((items) => {
          if (!cancelled) setListings(items);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    return () => { cancelled = true; };
  }, [setListings]);

  const columns: Column<AdminListing>[] = [
    { key: "id", label: "ID", render: (row) => <span className="text-[var(--text-muted)]">{row.id}</span> },
    {
      key: "hotelName",
      label: "Obyekt nomi",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--text-primary)]">{row.hotelName}</span>
          <span className="text-xs text-[var(--text-muted)]">{row.stars} yulduz</span>
        </div>
      ),
    },
    { key: "companyName", label: "Hamkor kompaniya", render: (row) => <span>{row.companyName}</span> },
    { key: "city", label: "Shahar", render: (row) => <span>{row.city}</span> },
    {
      key: "submittedAt",
      label: "Yuborilgan sana",
      render: (row) => (
        <span className="text-[var(--text-muted)]">
          {new Date(row.submittedAt).toISOString().split("T")[0]}
        </span>
      ),
    },
    {
      key: "featured",
      label: "Mashhur",
      render: (row) => (
        <button
          disabled={togglingId === row.id}
          onClick={async () => {
            setTogglingId(row.id);
            try {
              const result = await AdminApi.toggleListingFeatured(row.id, !row.featured);
              // Optimistik taxmin emas — serverdan qaytgan HAQIQIY holat
              // bilan yangilanadi (u source of truth).
              setListings(
                listings.map((l) =>
                  l.id === row.id ? { ...l, featured: result.featured } : l,
                ),
              );
              toast.success(
                result.featured ? "Mashhur takliflarga qo'shildi" : "Mashhur takliflardan olib tashlandi",
              );
            } catch (error) {
              toast.error(extractApiErrorMessage(error, "Xatolik yuz berdi"));
            } finally {
              setTogglingId(null);
            }
          }}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-wait ${
            row.featured
              ? "bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20"
              : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--border)]"
          }`}
        >
          {togglingId === row.id ? "..." : row.featured ? "Mashhur" : "Odatiy"}
        </button>
      ),
    },
    {
      key: "status",
      label: "Holat",
      render: (row) => <StatusBadge status={row.status} statusMap={LISTING_STATUS_MAP} />,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Link
            href={`/partners/listings/${row.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors text-xs font-medium"
          >
            <Eye size={14} />
            Batafsil ko'rish
          </Link>
        </div>
      ),
    },
  ];

  const TABS = [
    {
      id: "under_review",
      label: "Kutilmoqda",
      content: (
        <DataTable
          columns={columns}
          data={listings.filter((l) => l.status === "under_review")}
          keyField="id"
          emptyMessage="Kutilayotgan e'lonlar yo'q"
          isLoading={loading}
          isError={error}
          onRetry={fetchListings}
        />
      ),
    },
    {
      id: "published",
      label: "Tasdiqlangan",
      content: (
        <DataTable
          columns={columns}
          data={listings.filter((l) => l.status === "published")}
          keyField="id"
          emptyMessage="Tasdiqlangan e'lonlar yo'q"
          isLoading={loading}
          isError={error}
          onRetry={fetchListings}
        />
      ),
    },
    {
      id: "rejected",
      label: "Rad etilgan",
      content: (
        <DataTable
          columns={columns}
          data={listings.filter((l) => l.status === "rejected")}
          keyField="id"
          emptyMessage="Rad etilgan e'lonlar yo'q"
          isLoading={loading}
          isError={error}
          onRetry={fetchListings}
        />
      ),
    },
  ];



  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">E'lonlar</h1>
        <p className="text-sm text-[var(--text-muted)]">Hamkorlar tomonidan yuborilgan mehmonxona va yotoqxona e'lonlarini ko'rib chiqish.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Tabs tabs={TABS} />
      </div>
    </div>
  );
}
