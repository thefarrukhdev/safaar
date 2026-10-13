"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PartnerTeamMember, listTeamMembers, inviteTeamMember, deleteTeamMember, updateTeamMember } from "@/lib/api/endpoints/partners";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function TeamSettingsPage() {
  const confirm = useConfirm();
  const [members, setMembers] = useState<PartnerTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "staff" });
  const [submitting, setSubmitting] = useState(false);

  const fetchMembers = async () => {
    try {
      const data = await listTeamMembers(null);
      setMembers(data);
    } catch {
      toast.error("Jamoa a'zolarini yuklab bo'lmadi");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await listTeamMembers(null);
        if (!cancelled) setMembers(data);
      } catch {
        if (!cancelled) toast.error("Jamoa a'zolarini yuklab bo'lmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);


  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    setSubmitting(true);
    try {
      await inviteTeamMember(inviteForm, null);
      toast.success("Taklif yuborildi");
      setShowInviteModal(false);
      setInviteForm({ name: "", email: "", role: "staff" });
      fetchMembers();
    } catch {
      toast.error("Taklif yuborishda xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    const ok = await confirm({
      title: "Xodimni o'chirish",
      description: "Ushbu xodimni rostdan ham o'chirmoqchimisiz? Uning tizimga kirish ruxsati bekor qilinadi.",
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTeamMember(id, null);
      toast.success("Xodim o'chirildi");
      setMembers(members.filter((m) => m.id !== id));
    } catch {
      toast.error("Xodimni o'chirib bo'lmadi");
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await updateTeamMember(id, { role: newRole }, null);
      toast.success("Rol o'zgartirildi");
      setMembers(members.map((m) => (m.id === id ? { ...m, role: newRole as any } : m)));
    } catch {
      toast.error("Rolni o'zgartirib bo'lmadi");
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
            <Users size={20} className="text-[var(--primary)]" />
            Jamoa a'zolari
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Biznesingizni birgalikda boshqarish uchun xodimlarni taklif qiling.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/90"
        >
          <UserPlus size={16} />
          Xodim qo'shish
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--card)] overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-3 font-medium text-[var(--muted-foreground)]">Xodim</th>
              <th className="px-6 py-3 font-medium text-[var(--muted-foreground)]">Rol</th>
              <th className="px-6 py-3 font-medium text-[var(--muted-foreground)]">Holat</th>
              <th className="px-6 py-3 font-medium text-[var(--muted-foreground)] text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {members.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--muted-foreground)]">Xodimlar topilmadi</td></tr>
            ) : members.map((m) => (
              <tr key={m.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-[var(--foreground)]">{m.name}</div>
                  <div className="text-[var(--muted-foreground)] text-xs mt-0.5">{m.email}</div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="bg-transparent border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Menejer</option>
                    <option value="staff">Xodim (Staff)</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  {m.status === 'active' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Faol
                    </span>
                  ) : m.status === 'invited' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      Taklif qilingan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-500/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                      Bloklangan
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleRemove(m.id)} className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10 p-1.5 rounded transition-colors" title="O'chirish">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-[var(--background)] p-6 shadow-xl border border-[var(--border)]">
            <h3 className="text-lg font-semibold mb-4">Yangi xodimni taklif qilish</h3>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--muted-foreground)]">
                  Ism Familiya
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  placeholder="Masalan: Alisher Navoiy"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--muted-foreground)]">
                  Email manzil
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  placeholder="alisher@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--muted-foreground)]">
                  Rolni tanlang
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                >
                  <option value="admin">Admin (To'liq huquqlar)</option>
                  <option value="manager">Menejer (Narx va xonalar boshqaruvi)</option>
                  <option value="staff">Xodim (Faqat bronlarni ko'rish va qabul qilish)</option>
                </select>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Yuborilmoqda..." : "Taklif yuborish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
