"use client";

import { useState, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Trash2, ShieldCheck, Briefcase, User, Mail, CheckCircle2, Clock, Ban } from "lucide-react";
import { toast } from "sonner";
import {
  PartnerTeamMember,
  listTeamMembers,
  inviteTeamMember,
  deleteTeamMember,
  updateTeamMember,
} from "@/lib/api/endpoints/partners";
import { useAuthStore } from "@/stores/auth-store";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROLE_CONFIG: Record<
  string,
  { label: string; desc: string; icon: typeof User }
> = {
  admin: {
    label: "Admin",
    desc: "To'liq huquqlar (barcha bo'limlar)",
    icon: ShieldCheck,
  },
  manager: {
    label: "Menejer",
    desc: "Narx, xona va bronlar boshqaruvi",
    icon: Briefcase,
  },
  staff: {
    label: "Xodim",
    desc: "Faqat bronlarni ko'rish va qabul qilish",
    icon: User,
  },
};

export default function TeamSettingsPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.tokens?.accessToken);

  const {
    data: members = [],
    isLoading: loading,
  } = useQuery<PartnerTeamMember[]>({
    queryKey: ["partner", "team", token],
    queryFn: async () => {
      const res = await listTeamMembers(token);
      return Array.isArray(res) ? res : [];
    },
    enabled: Boolean(token),
  });

  const [showInviteModal, setShowInviteModal] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "staff" as "admin" | "manager" | "staff",
  });
  const [submitting, setSubmitting] = useState(false);

  const nameId = useId();
  const emailId = useId();
  const roleId = useId();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inviteForm.name.trim();
    const cleanEmail = inviteForm.email.trim();
    if (!cleanName || !cleanEmail) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    setSubmitting(true);
    try {
      await inviteTeamMember(
        { name: cleanName, email: cleanEmail, role: inviteForm.role },
        token,
      );
      toast.success("Taklif yuborildi");
      setShowInviteModal(false);
      setInviteForm({ name: "", email: "", role: "staff" });
      await queryClient.invalidateQueries({ queryKey: ["partner", "team"] });
    } catch {
      toast.error("Taklif yuborishda xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Xodimni o'chirish",
      description: `"${name}" xodimini rostdan ham o'chirmoqchimisiz? Uning tizimga kirish ruxsati bekor qilinadi.`,
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTeamMember(id, token);
      toast.success("Xodim o'chirildi");
      await queryClient.invalidateQueries({ queryKey: ["partner", "team"] });
    } catch {
      toast.error("Xodimni o'chirib bo'lmadi");
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await updateTeamMember(id, { role: newRole }, token);
      toast.success("Rol muvaffaqiyatli o'zgartirildi");
      await queryClient.invalidateQueries({ queryKey: ["partner", "team"] });
    } catch {
      toast.error("Rolni o'zgartirib bo'lmadi");
    }
  };

  const activeCount = members.filter((m) => m.status === "active").length;
  const invitedCount = members.filter((m) => m.status === "invited").length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users size={22} className="text-[var(--primary)]" />
            Jamoa a'zolari
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Biznesingizni birgalikda boshqarish uchun xodimlarni taklif qiling va ularning huquqlarini belgilang.
          </p>
        </div>
        <Button
          onClick={() => setShowInviteModal(true)}
          size="sm"
          variant="primary"
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <UserPlus size={16} />
          Xodim taklif qilish
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs text-[var(--muted-foreground)] font-medium">Jami xodimlar</span>
          <p className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">{members.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Faol a'zolar
          </span>
          <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <Clock size={14} /> Taklif kutilmoqda
          </span>
          <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">{invitedCount}</p>
        </div>
      </div>

      {/* Main Table / State */}
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12">
          <LoadingState
            title="Xodimlar yuklanmoqda..."
            description="Jamoa ro'yxati va ularning ruxsatlari olinmoqda"
          />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <EmptyState
            icon={<Users className="h-7 w-7 text-brand-600" />}
            title="Hali jamoa a'zolari yo'q"
            description="Admin, menejer yoki operatsion xodimlaringizni elektron pochta orqali taklif qilib boshqaruvni taqsimlang."
            action={
              <Button
                onClick={() => setShowInviteModal(true)}
                variant="primary"
                size="sm"
                className="gap-2"
              >
                <UserPlus size={16} />
                Birinchi xodimni taklif qilish
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
                  <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Xodim</th>
                  <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Boshqaruv roli</th>
                  <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Holat</th>
                  <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)] text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {members.map((m) => {
                  const initials = getInitials(m.name);
                  const roleInfo = ROLE_CONFIG[m.role] || ROLE_CONFIG.staff;
                  const RoleIcon = roleInfo.icon;

                  return (
                    <tr key={m.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-xs font-bold text-brand-700 dark:from-brand-900/60 dark:to-brand-800/40 dark:text-brand-300">
                            {initials}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {m.name}
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5 truncate">
                              <Mail size={12} className="shrink-0 text-zinc-400" />
                              {m.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <RoleIcon size={16} className="text-brand-600 dark:text-brand-400 shrink-0" />
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            aria-label={`${m.name} uchun rolni o'zgartirish`}
                            className="bg-transparent border border-[var(--border)] rounded-md px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-[var(--primary)] font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
                          >
                            <option value="admin">Admin (To'liq huquqlar)</option>
                            <option value="manager">Menejer (Narx va xonalar)</option>
                            <option value="staff">Xodim (Operatsiyalar)</option>
                          </select>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {m.status === "active" ? (
                          <Badge tone="emerald" variant="subtle" className="gap-1.5 font-normal">
                            <CheckCircle2 size={13} />
                            Faol
                          </Badge>
                        ) : m.status === "invited" ? (
                          <Badge tone="amber" variant="subtle" className="gap-1.5 font-normal">
                            <Clock size={13} />
                            Taklif qilingan
                          </Badge>
                        ) : (
                          <Badge tone="danger" variant="subtle" className="gap-1.5 font-normal">
                            <Ban size={13} />
                            Bloklangan
                          </Badge>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(m.id, m.name)}
                          className="h-8 w-8 min-h-0 min-w-0 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Xodimni o'chirish"
                          aria-label={`${m.name}ni o'chirish`}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Standardized Dialog for Inviting Team Member */}
      <Dialog
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Yangi xodimni taklif qilish"
        description="Xodimning elektron pochtasiga tizimga kirish va parolni sozlash uchun maxsus havola yuboriladi."
        size="md"
      >
        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId}>Ism Familiya</Label>
            <Input
              id={nameId}
              type="text"
              required
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              placeholder="Masalan: Alisher Navoiy"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId}>Email manzil</Label>
            <Input
              id={emailId}
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="alisher@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={roleId}>Ruxsat darajasi (Rol)</Label>
            <select
              id={roleId}
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({
                  ...inviteForm,
                  role: e.target.value as "admin" | "manager" | "staff",
                })
              }
              className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="admin">Admin — Barcha amallarni bajara oladi</option>
              <option value="manager">Menejer — Narx, xona va bronlar boshqaruvi</option>
              <option value="staff">Xodim — Faqat bronlarni ko'rish va check-in/out</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowInviteModal(false)}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
            >
              Taklif yuborish
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
