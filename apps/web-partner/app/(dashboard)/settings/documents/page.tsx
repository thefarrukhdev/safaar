"use client";

import { useEffect, useState, useRef } from "react";
import { FileText, Upload, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { PartnerDocument, listDocuments, uploadDocumentFile } from "@/app/_lib/api/endpoints/partners";
import { formatDate } from "@/app/_lib/utils/format";

export default function DocumentsSettingsPage() {
  const [documents, setDocuments] = useState<PartnerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState("license");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await listDocuments(null);
        if (!cancelled) setDocuments(data);
      } catch {
        if (!cancelled) toast.error("Hujjatlarni yuklab bo'lmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadDocumentFile(file, selectedType, null);
      toast.success("Hujjat yuklandi va tasdiqlash uchun yuborildi");
      const data = await listDocuments(null);
      setDocuments(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hujjat yuklashda xatolik");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Yuklanmoqda...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText size={20} className="text-[var(--primary)]" />
            Hujjatlar va Verifikatsiya
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Platformada faoliyat yuritish uchun kerakli litsenziya va sertifikatlarni yuklang.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--card)] p-5">
            <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm">Yangi hujjat yuklash</h3>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Hujjat turi</label>
                <select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full rounded border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] bg-transparent"
                >
                  <option value="license">Guvohnoma / Litsenziya</option>
                  <option value="passport">Pasport nusxasi</option>
                  <option value="tax_certificate">Soliq guvohnomasi</option>
                  <option value="other">Boshqa hujjat</option>
                </select>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf,.jpg,.jpeg,.png"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/90 disabled:opacity-50"
              >
                {uploading ? "Yuklanmoqda..." : (
                  <>
                    <Upload size={16} />
                    Fayl tanlash va yuklash
                  </>
                )}
              </button>
              <p className="text-[10px] text-[var(--muted-foreground)] text-center mt-1">
                Qabul qilinadigan formatlar: PDF, JPG, PNG. Maksimal hajm: 5MB.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-100 dark:border-blue-900">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Eslatma</h4>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Yangi yuklangan hujjatlar adminlar tomonidan tekshiriladi. Tekshiruv odatda 1-2 ish kuni davom etadi. 
              Guvohnomasi tasdiqlanmagan hamkorlar platformada ko'rinmaydi.
            </p>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--card)] overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                <tr>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Hujjat nomi</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Sana</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {documents.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-10 text-center text-[var(--muted-foreground)]">Sizda hali tasdiqlangan hujjatlar yo'q</td></tr>
                ) : documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="font-medium text-[var(--foreground)]">{doc.name}</div>
                          <div className="text-[var(--muted-foreground)] text-xs capitalize mt-0.5">{doc.type.replace('_', ' ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--muted-foreground)] text-sm">
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td className="px-5 py-4">
                      {doc.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 size={14} /> Tasdiqlangan
                        </span>
                      ) : doc.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                          <AlertCircle size={14} /> Rad etilgan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <Clock size={14} /> Ko'rib chiqilmoqda
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
