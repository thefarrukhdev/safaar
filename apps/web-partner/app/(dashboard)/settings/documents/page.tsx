"use client";

import { useState, useRef, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  Building,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import {
  PartnerDocument,
  listDocuments,
  uploadDocumentFile,
} from "@/lib/api/endpoints/partners";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";

const DOC_TYPE_INFO: Record<
  string,
  { label: string; icon: typeof FileText; description: string }
> = {
  license: {
    label: "Guvohnoma / Litsenziya",
    icon: Building,
    description: "Davlat ro'yxatidan o'tganlik to'g'risida guvohnoma",
  },
  passport: {
    label: "Pasport nusxasi",
    icon: CreditCard,
    description: "Rahbar yoki yakka tartibdagi tadbirkor shaxsini tasdiqlovchi hujjat",
  },
  tax_certificate: {
    label: "Soliq guvohnomasi",
    icon: FileCheck,
    description: "Soliq to'lovchining identifikatsiya raqami (STIR/INN) hujjati",
  },
  lease_contract: {
    label: "Ijara / Egalik shartnomasi",
    icon: FileText,
    description: "Obyektga egalik yoki ijara huquqini tasdiqlovchi shartnoma",
  },
  other: {
    label: "Boshqa hujjat",
    icon: FileText,
    description: "Qo'shimcha sertifikat yoki ruxsatnomalar",
  },
};

export default function DocumentsSettingsPage() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.tokens?.accessToken);

  const {
    data: documents = [],
    isLoading: loading,
  } = useQuery<PartnerDocument[]>({
    queryKey: ["partner", "documents", token],
    queryFn: async () => {
      const res = await listDocuments(token);
      return Array.isArray(res) ? res : [];
    },
    enabled: Boolean(token),
  });

  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("license");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typeSelectId = useId();

  const handleUploadFile = async (file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fayl hajmi 5MB dan oshmasligi kerak");
      return;
    }

    setUploading(true);
    try {
      await uploadDocumentFile(file, selectedType, token);
      toast.success("Hujjat yuklandi va tekshirish uchun yuborildi");
      await queryClient.invalidateQueries({ queryKey: ["partner", "documents"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Hujjat yuklashda xatolik yuz berdi",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleUploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleUploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const approvedCount = documents.filter((d) => d.status === "approved").length;
  const pendingCount = documents.filter(
    (d) => d.status === "pending" || d.status === "uploaded",
  ).length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText size={22} className="text-[var(--primary)]" />
          Hujjatlar va Verifikatsiya
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Platformada rasmiy hamkor sifatida faoliyat yuritish va to'lovlarni qabul qilish uchun kerakli hujjatlarni yuklang.
        </p>
      </div>

      {/* Verification status overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs text-[var(--muted-foreground)] font-medium">Jami hujjatlar</span>
          <p className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">{documents.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Tasdiqlangan
          </span>
          <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{approvedCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <Clock size={14} /> Ko'rib chiqilmoqda
          </span>
          <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">{pendingCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form Column */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--card)] p-5 shadow-sm">
            <h3 className="font-semibold text-[var(--foreground)] text-sm mb-4">
              Yangi hujjat yuklash
            </h3>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={typeSelectId}>Hujjat turi</Label>
                <select
                  id={typeSelectId}
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                >
                  <option value="license">Guvohnoma / Litsenziya</option>
                  <option value="passport">Pasport nusxasi</option>
                  <option value="tax_certificate">Soliq guvohnomasi (STIR)</option>
                  <option value="lease_contract">Ijara / Egalik shartnomasi</option>
                  <option value="other">Boshqa qo'shimcha hujjat</option>
                </select>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {DOC_TYPE_INFO[selectedType]?.description}
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
              />

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center ${
                  dragActive
                    ? "border-[var(--primary)] bg-brand-50/50 dark:bg-brand-950/20"
                    : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-2">
                  <Upload size={20} />
                </div>
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  Faylni shu yerga tashlang yoki bosing
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
                  PDF, JPG, PNG (maks. 5MB)
                </span>
              </div>

              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                loading={uploading}
                variant="primary"
                size="md"
                className="w-full gap-2"
              >
                <Upload size={16} />
                {uploading ? "Yuklanmoqda..." : "Fayl tanlash va yuklash"}
              </Button>
            </div>
          </div>

          {/* Verification Guidelines Card */}
          <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 p-4 border border-blue-200/60 dark:border-blue-900/50 flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              Verifikatsiya tartibi
            </h4>
            <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300/90">
              Yangi yuklangan hujjatlar xavfsizlik va muvofiqlik guruhi tomonidan 1-2 ish kuni davomida tekshiriladi.
            </p>
            <p className="text-[11px] text-blue-700 dark:text-blue-400">
              Tasdiqlanmagan obyektlar qidiruv natijalarida cheklangan ko'rsatiladi.
            </p>
          </div>
        </div>

        {/* Documents Table Column */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12">
              <LoadingState
                title="Hujjatlar yuklanmoqda..."
                description="Mavjud litsenziya va verifikatsiya hujjatlari olinmoqda"
              />
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8">
              <EmptyState
                icon={<FileText className="h-7 w-7 text-brand-600" />}
                title="Tasdiqlangan hujjatlar mavjud emas"
                description="Obyektingiz faoliyatini to'liq faollashtirish uchun guvohnoma yoki litsenziyani yuklang."
                action={
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="primary"
                    size="sm"
                    className="gap-2"
                  >
                    <Upload size={15} />
                    Hujjat yuklash
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--card)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                    <tr>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Hujjat nomi</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Yuklangan sana</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Holat</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)] text-right">Fayl</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {documents.map((doc) => {
                      const typeMeta = DOC_TYPE_INFO[doc.type] || DOC_TYPE_INFO.other;
                      const TypeIcon = typeMeta.icon;

                      return (
                        <tr key={doc.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                                <TypeIcon size={18} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                  {doc.name || typeMeta.label}
                                </span>
                                <span className="text-xs text-[var(--muted-foreground)] mt-0.5">
                                  {typeMeta.label}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-xs text-[var(--muted-foreground)]">
                            {formatDate(doc.uploaded_at)}
                          </td>

                          <td className="px-5 py-4">
                            {doc.status === "approved" ? (
                              <Badge tone="emerald" variant="subtle" className="gap-1.5 font-normal">
                                <CheckCircle2 size={13} />
                                Tasdiqlangan
                              </Badge>
                            ) : doc.status === "rejected" ? (
                              <Badge tone="danger" variant="subtle" className="gap-1.5 font-normal">
                                <AlertCircle size={13} />
                                Rad etilgan
                              </Badge>
                            ) : (
                              <Badge tone="amber" variant="subtle" className="gap-1.5 font-normal">
                                <Clock size={13} />
                                Ko'rib chiqilmoqda
                              </Badge>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            {doc.url ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium hover:underline p-1.5 rounded"
                                title="Hujjatni ko'rish"
                              >
                                Ko'rish
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span className="text-xs text-[var(--muted-foreground)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
