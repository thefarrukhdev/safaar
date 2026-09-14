"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Key, Edit, Ban, CheckCircle2, Mail, Phone, Calendar, Check, X, ShieldQuestion } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import { AdminApi } from "@/lib/api/admin-api";
import { AdminUser, AdminRole } from "@/types/admin";
import { useAuthStore } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

const teamUserSchema = z.object({
  fullName: z.string().min(2, "F.I.SH kamida 2 harfdan iborat bo'lishi kerak"),
  email: z.string().email("Yaroqli elektron pochta kiriting"),
  phone: z.string().optional(),
  role: z.enum([
    "SUPER_ADMIN",
    "ADMIN",
    "MODERATOR",
    "FINANCE_ADMIN",
    "CONTENT_ADMIN",
    "SUPPORT_ADMIN",
  ]),
  password: z.string().optional(),
});

type TeamUserFormValues = z.infer<typeof teamUserSchema>;

// 2026-09-14 SAFAAR ADMIN audit: backenddagi `Role` enum'ida (`packages/types`)
// ALLAQACHON mavjud bo'lgan, lekin bu yerda YO'Q edi — `ADMIN`/`SUPPORT_ADMIN`
// tanlab bo'lmasdi (backend qabul qiladi, lekin UI orqali hech qachon
// tanlanmas edi). "PARTNER_MANAGER" — mavjud `MODERATOR` roliga moslashtirildi
// (backend `common/permissions.ts`ga qarang, yangi parallel rol yaratilmadi).
const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MODERATOR: "Hamkor menejeri",
  FINANCE_ADMIN: "Moliya menejeri",
  CONTENT_ADMIN: "Kontent menejeri",
  SUPPORT_ADMIN: "Qo'llab-quvvatlash menejeri",
};

const ROLE_COLORS: Record<AdminRole, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  ADMIN: "bg-slate-100 text-slate-700 border-slate-200",
  MODERATOR: "bg-blue-100 text-blue-700 border-blue-200",
  FINANCE_ADMIN: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CONTENT_ADMIN: "bg-amber-100 text-amber-700 border-amber-200",
  SUPPORT_ADMIN: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

// Faqat KO'RSATISH uchun (guruh nomi/tartib) — ruxsatlarning O'ZI
// hardcoded emas, GET /admin/roles orqali real backenddan keladi. Yangi
// domen backendda paydo bo'lsa, bu yerda yo'q bo'lsa ham matritsada
// (raw key bilan) ko'rinaveradi — hech narsa yashirilmaydi.
const PERMISSION_DOMAIN_LABELS: Record<string, string> = {
  users: "Foydalanuvchilar",
  partners: "Hamkorlar",
  bookings: "Bronlar",
  finance: "Moliya",
  payments: "To'lovlar",
  settlements: "Hisob-kitoblar",
  customers: "Mijozlar",
  cms: "Kontent (CMS)",
  reviews: "Sharhlar",
  translations: "Tarjimalar",
  seo: "SEO",
  support: "Qo'llab-quvvatlash",
  settings: "Sozlamalar",
  "admin-users": "Xodimlar (yaratish/tahrirlash)",
  admins: "Xodimlarni boshqarish",
  roles: "Rol/ruxsatlar",
  "audit-logs": "Audit jurnali",
  listings: "E'lonlar",
  availability: "Xona availability",
};

function permissionDomainLabel(permission: string): string {
  const domain = permission.split(":")[0];
  return PERMISSION_DOMAIN_LABELS[domain] ?? domain;
}

function permissionActionLabel(permission: string): string {
  const action = permission.split(":")[1] ?? permission;
  const ACTION_LABELS: Record<string, string> = {
    read: "ko'rish",
    write: "yozish/tahrirlash",
    edit: "tahrirlash",
    moderate: "moderatsiya",
    manage: "boshqarish",
    block: "bloklash",
    cancel: "bekor qilish",
    refund: "qaytarish",
  };
  return ACTION_LABELS[action] ?? action;
}

export default function TeamPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState("");
  const { user: currentUser } = useAuthStore();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeamUserFormValues>({
    resolver: zodResolver(teamUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      role: "MODERATOR",
      password: "",
    },
  });

  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  // Permission matrix — real GET /admin/roles data (common/permissions.ts
  // rolePermissions, the actual map RolesGuard enforces), not a hardcoded
  // duplicate list that could silently drift from backend reality.
  const [roleMatrix, setRoleMatrix] = useState<{ id: string; permissions: string[] }[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixError, setMatrixError] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await AdminApi.getTeamUsers();
      setUsers(data);
    } catch (err) {
      toast.error("Xodimlarni yuklab bo'lmadi");
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await AdminApi.getTeamUsers();
        if (!cancelled) setUsers(data);
      } catch {
        if (!cancelled) {
          toast.error("Xodimlarni yuklab bo'lmadi");
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await AdminApi.getRoles();
        if (!cancelled) setRoleMatrix(data);
      } catch {
        if (!cancelled) setMatrixError(true);
      } finally {
        if (!cancelled) setMatrixLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    reset({ fullName: "", email: "", phone: "", role: "MODERATOR", password: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (u: AdminUser) => {
    setEditingUser(u);
    reset({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone || "",
      role: u.role,
      password: "",
    });
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const onSubmit = async (data: TeamUserFormValues) => {
    try {
      if (editingUser) {
        await AdminApi.updateTeamUser(editingUser.id, data);
        toast.success("Xodim ma'lumotlari yangilandi");
      } else {
        if (!data.password) return toast.error("Parol kiritish majburiy");
        await AdminApi.createTeamUser(data);
        toast.success("Yangi xodim qo'shildi");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await AdminApi.updateTeamUserStatus(id, !currentStatus);
      toast.success(currentStatus ? "Xodim bloklandi" : "Xodim faollashtirildi");
      setUsers(users.map(u => u.id === id ? { ...u, isActive: !currentStatus } : u));
    } catch {
      toast.error("Holatni o'zgartirib bo'lmadi");
    }
    setDropdownOpen(null);
  };

  const handleReset2FA = async (id: string) => {
    if (!confirm("Haqiqatan ham ushbu xodimning 2FA himoyasini olib tashlamoqchimisiz?")) return;
    try {
      await AdminApi.resetTeamUser2FA(id);
      toast.success("2FA muvaffaqiyatli o'chirildi");
    } catch {
      toast.error("2FA ni o'chirib bo'lmadi");
    }
    setDropdownOpen(null);
  };

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Backend admin.service.ts::adminUserUpdate ATAYLAB rad etadi (403
  // ADMIN_SELF_ROLE_CHANGE_DENIED) — frontend shu holatni oldindan
  // ko'rsatadi, lekin haqiqiy himoya baribir backendda.
  const isEditingSelf = Boolean(editingUser && editingUser.id === currentUser?.id);

  const columns: Column<AdminUser>[] = [
    {
      key: "fullName",
      label: "Xodim",
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
            {u.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              {u.fullName}
              {u.id === currentUser?.id && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Siz</span>
              )}
            </div>
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
              <Mail size={12} /> {u.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Rol",
      render: (u) => (
        <span className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", ROLE_COLORS[u.role] || "bg-slate-100 text-slate-700")}>
          {ROLE_LABELS[u.role] || u.role}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Telefon",
      render: (u) => u.phone ? (
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Phone size={14} /> {u.phone}
        </div>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    },
    {
      key: "lastLogin",
      label: "So'nggi faollik",
      render: (u) => (
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Calendar size={14} />
          {new Date(u.lastLogin).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Holat",
      render: (u) => (
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-red-500")} />
          {u.isActive ? "Faol" : "Bloklangan"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (u) => (
        <div className="flex justify-end relative">
          <button
            onClick={() => setDropdownOpen(dropdownOpen === u.id ? null : u.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical size={18} />
          </button>

          {dropdownOpen === u.id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(null)} />
              <div className="absolute right-0 top-8 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-20 py-1 overflow-hidden">
                <button
                  onClick={() => openEditModal(u)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Edit size={16} className="text-slate-400" /> Tahrirlash
                </button>
                
                <button
                  onClick={() => handleReset2FA(u.id)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Key size={16} className="text-slate-400" /> 2FA ni o'chirish
                </button>
                
                <div className="h-px bg-slate-100 my-1" />
                
                {u.id !== currentUser?.id && (
                  <button
                    onClick={() => handleToggleStatus(u.id, u.isActive)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors",
                      u.isActive ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"
                    )}
                  >
                    {u.isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                    {u.isActive ? "Bloklash" : "Faollashtirish"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Jamoasi</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Platformani boshqaruvchi xodimlar va ularning ruxsatlari
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Izlash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none w-full sm:w-64 transition-all"
            />
          </div>
          <Button onClick={openAddModal} icon={<Plus size={16} />}>
            Xodim qo'shish
          </Button>
        </div>
      </div>

      {/* Content */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        keyField="id"
        emptyMessage="Xodimlar topilmadi"
        isLoading={loading}
        isError={error}
        onRetry={fetchUsers}
        className="flex-1"
      />

      {/* Permission Matrix — real backend rolePermissions (2026-09-14).
          Heading/error text intentionally matches what
          e2e/tests/admin/critical-flow.spec.ts already expected
          (pre-existing test, written before this section existed). */}
      <Card padding="lg" className="mt-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Rollar va ruxsatlar</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1 mb-4">
          Har bir rol nimani ko&apos;ra/o&apos;zgartira olishi — to&apos;g&apos;ridan-to&apos;g&apos;ri
          backend RolesGuard tomonidan ishlatiladigan haqiqiy ruxsatlar ro&apos;yxati
          (frontendda alohida saqlanmaydi). SUPER_ADMIN har doim barcha ruxsatga ega.
        </p>

        {matrixLoading ? (
          <div className="space-y-2" role="status" aria-label="Yuklanmoqda">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : matrixError ? (
          <div className="flex flex-col items-center text-center gap-3 py-10">
            <ShieldQuestion size={24} className="text-[var(--danger)]" aria-hidden />
            <p className="text-sm text-[var(--text-secondary)]">
              Ruxsatlarni yuklab bo&apos;lmadi
            </p>
          </div>
        ) : (
          (() => {
            // USER/PARTNER — bular admin-panel roli EMAS (mijoz/hamkor
            // portali uchun, `rolePermissions`da bor lekin bu "Admin
            // Jamoasi" matritsasiga aloqasi yo'q) — ROLE_LABELS'dagi 6 ta
            // admin roliga cheklaymiz.
            const adminRoleMatrix = roleMatrix.filter((r) =>
              Object.prototype.hasOwnProperty.call(ROLE_LABELS, r.id.toUpperCase()),
            );
            const roleIds = adminRoleMatrix.map((r) => r.id.toUpperCase());
            const allPermissions = Array.from(
              new Set(adminRoleMatrix.flatMap((r) => r.permissions)),
            ).sort();
            const grouped = new Map<string, string[]>();
            for (const permission of allPermissions) {
              const domain = permissionDomainLabel(permission);
              grouped.set(domain, [...(grouped.get(domain) ?? []), permission]);
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" role="grid" aria-label="Rol va ruxsatlar matritsasi">
                  <thead>
                    <tr>
                      <th scope="col" className="text-left font-medium text-[var(--text-muted)] pb-2 pr-4 sticky left-0 bg-white">
                        Ruxsat
                      </th>
                      {roleIds.map((roleId) => (
                        <th
                          key={roleId}
                          scope="col"
                          className="text-center font-medium text-[var(--text-muted)] pb-2 px-3 whitespace-nowrap"
                        >
                          {ROLE_LABELS[roleId as AdminRole] ?? roleId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...grouped.entries()].map(([domainLabel, permissions]) => (
                      <Fragment key={domainLabel}>
                        <tr>
                          <td
                            colSpan={roleIds.length + 1}
                            className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                          >
                            {domainLabel}
                          </td>
                        </tr>
                        {permissions.map((permission) => (
                          <tr key={permission} className="border-t border-[var(--border)]">
                            <td className="py-2 pr-4 text-[var(--text-secondary)] sticky left-0 bg-white">
                              {permissionActionLabel(permission)}
                              <span className="text-[var(--text-muted)] text-xs ml-1">({permission})</span>
                            </td>
                            {adminRoleMatrix.map((role) => {
                              const granted = role.permissions.includes(permission);
                              return (
                                <td key={role.id} className="text-center px-3">
                                  {granted ? (
                                    <Check
                                      size={16}
                                      className="inline text-[var(--success)]"
                                      aria-label="Ruxsat berilgan"
                                    />
                                  ) : (
                                    <X
                                      size={16}
                                      className="inline text-slate-300"
                                      aria-label="Ruxsat yo'q"
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editingUser ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">F.I.SH</label>
                <input
                  type="text"
                  {...register("fullName")}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all"
                  placeholder="Ism Familiya"
                />
                {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all"
                  placeholder="admin@safaar.uz"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Telefon</label>
                <input
                  type="tel"
                  {...register("phone")}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all"
                  placeholder="+998..."
                />
              </div>

              <div>
                <label htmlFor="team-role-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Rol</label>
                <select
                  id="team-role-select"
                  {...register("role")}
                  disabled={isEditingSelf}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {Object.entries(ROLE_LABELS)
                    .filter(([key]) => key !== "SUPER_ADMIN" || currentUser?.role === "SUPER_ADMIN")
                    .map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                {isEditingSelf && (
                  <p className="text-slate-400 text-xs mt-1">
                    O&apos;zingizning rolingizni o&apos;zgartira olmaysiz — backend buni bloklaydi.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Parol {editingUser && <span className="text-slate-400 font-normal">(o'zgartirish uchun kiriting)</span>}
                </label>
                <input
                  type="password"
                  {...register("password")}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all"
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
                  Bekor qilish
                </Button>
                <Button type="submit" loading={isSubmitting} className="flex-1">
                  Saqlash
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
