"use client";

import { useState, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Code2,
  Key,
  Globe,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
  Plus,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import {
  PartnerApiKey,
  PartnerWebhook,
  listApiKeys,
  createApiKey,
  deleteApiKey,
  listWebhooks,
  createWebhook,
  deleteWebhook,
} from "@/lib/api/endpoints/partners";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils/format";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AVAILABLE_WEBHOOK_EVENTS = [
  { id: "booking.created", label: "Bron yaratilishi (booking.created)" },
  { id: "booking.updated", label: "Bron holati o'zgarishi (booking.updated)" },
  { id: "booking.cancelled", label: "Bron bekor qilinishi (booking.cancelled)" },
  { id: "review.created", label: "Yangi fikr/sharh qoldirilishi (review.created)" },
];

export default function DeveloperSettingsPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.tokens?.accessToken);

  const {
    data: apiKeys = [],
    isLoading: keysLoading,
  } = useQuery<PartnerApiKey[]>({
    queryKey: ["partner", "api-keys", token],
    queryFn: async () => {
      const res = await listApiKeys(token);
      return Array.isArray(res) ? res : [];
    },
    enabled: Boolean(token),
  });

  const {
    data: webhooks = [],
    isLoading: webhooksLoading,
  } = useQuery<PartnerWebhook[]>({
    queryKey: ["partner", "webhooks", token],
    queryFn: async () => {
      const res = await listWebhooks(token);
      return Array.isArray(res) ? res : [];
    },
    enabled: Boolean(token),
  });

  const loading = keysLoading || webhooksLoading;
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks">("keys");

  // Key creation state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKeyString, setNewKeyString] = useState<string | null>(null);

  // Webhook creation state
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "booking.created",
    "booking.updated",
  ]);

  const [submitting, setSubmitting] = useState(false);

  const keyNameId = useId();
  const webhookUrlId = useId();

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = keyName.trim();
    if (!cleanName) return;

    setSubmitting(true);
    try {
      const data = await createApiKey({ name: cleanName }, token);
      setNewKeyString(data.key);
      setKeyName("");
      await queryClient.invalidateQueries({ queryKey: ["partner", "api-keys"] });
      toast.success("Yangi API kalit yaratildi");
    } catch {
      toast.error("Kalit yaratishda xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.startsWith("https://") && !cleanUrl.startsWith("http://localhost")) {
      toast.error("Webhook xavfsiz HTTPS protokolida bo'lishi shart");
      return;
    }

    if (selectedEvents.length === 0) {
      toast.error("Kamida bitta hodisani tanlang");
      return;
    }

    setSubmitting(true);
    try {
      await createWebhook(
        { url: cleanUrl, events: selectedEvents },
        token,
      );
      toast.success("Webhook muvaffaqiyatli qo'shildi");
      setShowWebhookModal(false);
      setWebhookUrl("");
      setSelectedEvents(["booking.created", "booking.updated"]);
      await queryClient.invalidateQueries({ queryKey: ["partner", "webhooks"] });
    } catch {
      toast.error("Webhook qo'shishda xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKey = async (id: string, name: string) => {
    const ok = await confirm({
      title: "API kalitini o'chirish",
      description: `"${name}" kalitini rostdan ham o'chirmoqchimisiz? Kalit orqali bog'langan tashqi integratsiyalar zudlik bilan ishlamay qoladi.`,
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteApiKey(id, token);
      toast.success("API kaliti o'chirildi");
      await queryClient.invalidateQueries({ queryKey: ["partner", "api-keys"] });
    } catch {
      toast.error("Kalitni o'chirib bo'lmadi");
    }
  };

  const handleDeleteWebhook = async (id: string, url: string) => {
    const ok = await confirm({
      title: "Webhookni o'chirish",
      description: `"${url}" manziliga yo'naltirilgan webhookni o'chirmoqchimisiz? Hodisalar ushbu URL ga yuborilmaydi.`,
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteWebhook(id, token);
      toast.success("Webhook o'chirildi");
      await queryClient.invalidateQueries({ queryKey: ["partner", "webhooks"] });
    } catch {
      toast.error("Webhookni o'chirib bo'lmadi");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Nusxa olindi!");
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId],
    );
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 max-w-5xl">
        <LoadingState
          title="Dasturchi vositalari yuklanmoqda..."
          description="API kalitlar va webhook konfiguratsiyalari olinmoqda"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Code2 size={22} className="text-[var(--primary)]" />
            Dasturchi va API
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            O'z tizimlaringiz bilan Safaar platformasi o'rtasida API kalitlar va Webhooklar orqali avtomatlashtirilgan integratsiya quring.
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "keys" | "webhooks")}
        variant="underline"
      >
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key size={16} /> API Kalitlar ({apiKeys.length})
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Globe size={16} /> Webhooklar ({webhooks.length})
          </TabsTrigger>
        </TabsList>

        {/* API Keys Content */}
        <TabsContent value="keys" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-50/60 dark:bg-brand-950/20 p-4 rounded-xl border border-brand-200/60 dark:border-brand-900/40">
            <div>
              <h4 className="text-sm font-semibold text-brand-900 dark:text-brand-300">
                Shaxsiy API Kalitlar
              </h4>
              <p className="text-xs text-brand-700 dark:text-brand-400 mt-1">
                PMS tizimingiz, Telegram botingiz yoki shaxsiy CRM orqali bronlar va xonalarni boshqarish uchun kalit yarating.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewKeyString(null);
                setKeyName("");
                setShowKeyModal(true);
              }}
              className="gap-1.5 shrink-0"
            >
              <Plus size={16} />
              Yangi kalit yaratish
            </Button>
          </div>

          {apiKeys.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8">
              <EmptyState
                icon={<Key className="h-7 w-7 text-brand-600" />}
                title="Hozircha API kalitlar yo'q"
                description="Tashqi tizimlar bilan ma'lumot almashish uchun yangi maxfiy API kalit yarating."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setNewKeyString(null);
                      setKeyName("");
                      setShowKeyModal(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus size={16} />
                    Birinchi kalitni yaratish
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
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Nomi</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Prefiks</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Yaratilgan</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)] text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {apiKeys.map((k) => (
                      <tr key={k.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                        <td className="px-5 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {k.name}
                        </td>
                        <td className="px-5 py-4">
                          <code className="font-mono text-xs bg-[var(--surface-muted)] px-2 py-1 rounded border border-[var(--border)] text-zinc-700 dark:text-zinc-300">
                            {k.keyPrefix}••••••••••••••••
                          </code>
                        </td>
                        <td className="px-5 py-4 text-xs text-[var(--muted-foreground)]">
                          {formatDate(k.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteKey(k.id, k.name)}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="O'chirish"
                            aria-label={`${k.name} kalitini o'chirish`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick API Docs Hint */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-3">
            <h5 className="text-sm font-semibold flex items-center gap-2">
              <Terminal size={16} className="text-brand-600" />
              API orqali ulanish namunasi
            </h5>
            <div className="bg-zinc-900 text-zinc-100 rounded-lg p-3.5 font-mono text-xs overflow-x-auto leading-relaxed">
              curl -H &quot;Authorization: Bearer sec_live_YOUR_KEY&quot; \<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;https://api.safaar.uz/api/partners/dashboard
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              API kalitlarini brauzer frontend kodiga joylashtirmang. Ularni faqat server xizmatlarida yashirin muhit (ENV) o'zgaruvchisi sifatida saqlang.
            </p>
          </div>
        </TabsContent>

        {/* Webhooks Content */}
        <TabsContent value="webhooks" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-indigo-50/60 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40">
            <div>
              <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
                Webhook Integratsiya
              </h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                Yangi bronlar, to'lovlar yoki bekor qilishlar yuz berganda serveringizga tezkor HTTP POST xabarnomalar oling.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setWebhookUrl("");
                setSelectedEvents(["booking.created", "booking.updated"]);
                setShowWebhookModal(true);
              }}
              className="gap-1.5 shrink-0"
            >
              <Plus size={16} />
              Webhook qo'shish
            </Button>
          </div>

          {webhooks.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8">
              <EmptyState
                icon={<Globe className="h-7 w-7 text-indigo-600" />}
                title="Hozircha Webhooklar yo'q"
                description="Hodisalarga real vaqtda reaksiya qilish uchun serveringiz URL manzilini ulang."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setWebhookUrl("");
                      setSelectedEvents(["booking.created", "booking.updated"]);
                      setShowWebhookModal(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus size={16} />
                    Birinchi webhookni qo'shish
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
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Endpoint URL</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Hodisalar</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Holat</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)]">Yaratilgan</th>
                      <th className="px-5 py-3.5 font-medium text-[var(--muted-foreground)] text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {webhooks.map((w) => (
                      <tr key={w.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                        <td className="px-5 py-4 max-w-xs truncate">
                          <span className="font-mono text-xs text-brand-700 dark:text-brand-300 font-medium">
                            {w.url}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {w.events && w.events.length > 0 ? (
                              w.events.map((ev) => (
                                <span
                                  key={ev}
                                  className="text-[10px] font-mono bg-[var(--surface-muted)] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded border border-[var(--border)]"
                                >
                                  {ev}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-[var(--muted-foreground)]">Barcha hodisalar</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {w.isActive ? (
                            <Badge tone="emerald" variant="subtle" className="gap-1 font-normal">
                              <CheckCircle2 size={13} />
                              Faol
                            </Badge>
                          ) : (
                            <Badge tone="danger" variant="subtle" className="gap-1 font-normal">
                              <XCircle size={13} />
                              To'xtatilgan
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-[var(--muted-foreground)]">
                          {formatDate(w.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWebhook(w.id, w.url)}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="O'chirish"
                            aria-label={`${w.url} webhookini o'chirish`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog for Creating API Key */}
      <Dialog
        open={showKeyModal}
        onClose={() => {
          setShowKeyModal(false);
          setNewKeyString(null);
        }}
        title={newKeyString ? "API Kalit Yaratildi" : "Yangi API Kalit yaratish"}
        description={
          newKeyString
            ? "Quyidagi maxfiy kalitni xavfsiz joyga saqlang. Bu kalit tizimda boshqa qayta ko'rsatilmaydi!"
            : "Tashqi ilovangiz uchun alohida nom va tavsif bering."
        }
        size="md"
        footer={
          newKeyString ? (
            <div className="flex justify-end w-full">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowKeyModal(false);
                  setNewKeyString(null);
                }}
              >
                Tushundim, saqlab oldim
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowKeyModal(false)}
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                form="create-api-key-form"
                variant="primary"
                size="sm"
                loading={submitting}
              >
                Kalit yaratish
              </Button>
            </div>
          )
        }
      >
        {newKeyString ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
              <ShieldAlert size={18} className="shrink-0 text-amber-600" />
              <span>
                Ushbu kalitni xavfsiz joyda saqlang. Agar uni yo'qotsangiz, yangi kalit yaratishingizga to'g'ri keladi.
              </span>
            </div>

            <div className="bg-[var(--surface-muted)] p-3 rounded-lg flex items-center justify-between gap-2 border border-[var(--border)]">
              <code className="text-xs font-mono break-all text-zinc-900 dark:text-zinc-100 select-all">
                {newKeyString}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(newKeyString)}
                className="h-8 w-8 text-brand-600 hover:text-brand-700 shrink-0"
                title="Kalitdan nusxa olish"
                aria-label="Kalitdan nusxa olish"
              >
                <Copy size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <form id="create-api-key-form" onSubmit={handleCreateKey} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={keyNameId}>Kalit nomi / Ilova nomi</Label>
              <Input
                id={keyNameId}
                type="text"
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Masalan: Test Servis yoki PMS Integratsiya"
              />
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Kalit nima maqsadda ishlatilishini eslab qolish uchun aniq nom bering.
              </p>
            </div>
          </form>
        )}
      </Dialog>

      {/* Dialog for Adding Webhook */}
      <Dialog
        open={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        title="Yangi Webhook qo'shish"
        description="Safaar platformasida sodir bo'ladigan o'zgarishlar to'g'risida sizning serveringizga yuboriladigan HTTP POST so'rovini sozlang."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowWebhookModal(false)}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              form="add-webhook-form"
              variant="primary"
              size="sm"
              loading={submitting}
            >
              Webhook qo'shish
            </Button>
          </div>
        }
      >
        <form id="add-webhook-form" onSubmit={handleCreateWebhook} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={webhookUrlId}>Endpoint URL (HTTPS)</Label>
            <Input
              id={webhookUrlId}
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.example.com/safaar-webhook"
            />
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Serveringiz 2xx HTTP javob qaytarishi shart, aks holda tizim qayta urinadi.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Obuna bo'linadigan hodisalar</Label>
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 bg-[var(--surface-muted)]/50">
              {AVAILABLE_WEBHOOK_EVENTS.map((ev) => {
                const checked = selectedEvents.includes(ev.id);
                return (
                  <label
                    key={ev.id}
                    className="flex items-center gap-2.5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEvent(ev.id)}
                      className="rounded border-[var(--border)] text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    <span>{ev.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
