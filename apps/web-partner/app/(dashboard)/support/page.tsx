"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Headset,
  Plus,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../../_components/layout/page-header";
import { Button } from "../../_components/ui/button";
import { Input } from "../../_components/ui/input";
import { Badge } from "../../_components/ui/badge";
import { Dialog } from "../../_components/ui/dialog";
import { EmptyState } from "../../_components/ui/empty-state";
import { support } from "../../_lib/api";
import { useAuthStore } from "../../_stores/auth-store";
import { cn } from "../../_lib/utils/cn";
import { formatDate } from "../../_lib/utils/format";
import type { SupportTicket } from "../../_lib/api/endpoints/support";

const ticketsQueryKey = ["partner", "support", "tickets"] as const;

function statusBadge(status: SupportTicket["status"]) {
  switch (status) {
    case "open":
      return <Badge tone="brand">Ochiq</Badge>;
    case "in_progress":
      return <Badge tone="warning">Jarayonda</Badge>;
    case "closed":
      return <Badge tone="neutral">Yopilgan</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

function priorityBadge(priority: SupportTicket["priority"]) {
  switch (priority) {
    case "urgent":
      return <Badge tone="danger">Shoshilinch</Badge>;
    case "high":
      return <Badge tone="warning">Yuqori</Badge>;
    case "medium":
      return <Badge tone="accent">O'rta</Badge>;
    case "low":
      return <Badge tone="neutral">Past</Badge>;
    default:
      return null;
  }
}

export default function SupportPage() {
  const accessToken = useAuthStore((state) => state.tokens?.accessToken);
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newMessageText, setNewMessageText] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<SupportTicket["priority"]>("medium");
  const [newTicketInitialMessage, setNewTicketInitialMessage] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const ticketsQuery = useQuery({
    queryKey: [...ticketsQueryKey, accessToken],
    queryFn: () => support.listTickets(accessToken),
    enabled: Boolean(accessToken),
  });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const activeTicketId = selectedTicketId ?? tickets[0]?.id;

  const ticketQuery = useQuery({
    queryKey: ["partner", "support", "ticket", activeTicketId, accessToken],
    queryFn: () =>
      support.getTicket(
        activeTicketId ?? "",
        accessToken,
      ),
    enabled: Boolean(accessToken && activeTicketId),
  });

  const activeTicket = ticketQuery.data ?? tickets.find((t) => t.id === activeTicketId);
  const messages = useMemo(
    () => ticketQuery.data?.messages ?? [],
    [ticketQuery.data?.messages],
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const ticket = await support.createTicket(
        {
          subject: newTicketSubject.trim(),
          priority: newTicketPriority,
        },
        accessToken,
      );
      if (newTicketInitialMessage.trim()) {
        await support.sendMessage(ticket.id, newTicketInitialMessage.trim(), accessToken);
      }
      return ticket;
    },
    onSuccess: (ticket) => {
      toast.success("Yangi murojaat yaratildi");
      setNewTicketSubject("");
      setNewTicketInitialMessage("");
      setNewTicketPriority("medium");
      setNewTicketOpen(false);
      setSelectedTicketId(ticket.id);
      setShowMobileChat(true);
      void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
      void queryClient.invalidateQueries({
        queryKey: ["partner", "support", "ticket", ticket.id],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Murojaat yaratilmadi");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!activeTicketId) {
        throw new Error("Murojaat tanlanmagan");
      }
      return support.sendMessage(activeTicketId, text, accessToken);
    },
    onSuccess: () => {
      setNewMessageText("");
      void queryClient.invalidateQueries({
        queryKey: ["partner", "support", "ticket", activeTicketId],
      });
      void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Xabar yuborilmadi");
    },
  });

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const text = newMessageText.trim();
    if (!text || !activeTicketId) return;
    sendMessageMutation.mutate(text);
  };

  const handleCreateTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim()) {
      toast.error("Murojaat mavzusini kiriting");
      return;
    }
    createTicketMutation.mutate();
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-100px)] w-full max-w-6xl flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <PageHeader
          eyebrow="Qo'llab-quvvatlash"
          title="Yordam markazi"
          description="Safaar ma'muriyati bilan tezkor bog'lanish va masalalarni hal qilish markazi."
        />
        <Button onClick={() => setNewTicketOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Yangi murojaat
        </Button>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm md:grid-cols-[320px_1fr]">
        {/* Chap panel — Chiptalar ro'yxati */}
        <div
          className={cn(
            "flex flex-col border-r border-[var(--border)] bg-[var(--surface-muted)]/50 md:flex",
            showMobileChat ? "hidden md:flex" : "flex",
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Murojaatlar ({tickets.length})
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNewTicketOpen(true)}
              className="h-7 min-h-0 px-2 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              + Yangi
            </Button>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
            {ticketsQuery.isLoading ? (
              <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                Murojaatlar yuklanmoqda...
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-12 text-center px-4">
                <Headset className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                <p className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Hali murojaatlar yo'q
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  Savol yoki taklifingiz bo'lsa, yangi murojaat yarating.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => setNewTicketOpen(true)}
                >
                  Murojaat ochish
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {tickets.map((t) => {
                  const isActive = t.id === activeTicketId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTicketId(t.id);
                        setShowMobileChat(true);
                      }}
                      className={cn(
                        "flex flex-col gap-1.5 rounded-lg p-3 text-left transition-all",
                        isActive
                          ? "bg-white shadow-sm ring-1 ring-brand-500/30 dark:bg-zinc-800"
                          : "hover:bg-white/60 dark:hover:bg-zinc-800/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-semibold text-[var(--foreground)]">
                          {t.subject}
                        </span>
                        {statusBadge(t.status)}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                        <span>{priorityBadge(t.priority)}</span>
                        <span>{formatDate(t.created_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* O'ng panel — Xabarlar oqimi va Chat */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col bg-[var(--surface)] md:flex",
            !showMobileChat ? "hidden md:flex" : "flex",
          )}
        >
          {activeTicket ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMobileChat(false)}
                    className="h-8 w-8 min-h-0 min-w-0 p-0 md:hidden"
                    aria-label="Orqaga"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                    <Headset className="h-5 w-5" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <h3 className="line-clamp-1 text-sm font-bold text-[var(--foreground)]">
                      {activeTicket.subject}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                      <span>{statusBadge(activeTicket.status)}</span>
                      <span>·</span>
                      <span>{priorityBadge(activeTicket.priority)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Xabarlar maydoni */}
              <div
                ref={chatContainerRef}
                className="custom-scrollbar flex-1 overflow-y-auto bg-zinc-50/50 p-4 dark:bg-zinc-950/20 md:p-6"
              >
                {ticketQuery.isLoading ? (
                  <p className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                    Xabarlar yuklanmoqda...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Bu murojaatda hali xabarlar yo'q
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Quyidagi maydonga savolingizni yozib yuboring.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((message) => {
                      const isPartner = message.sender_type === "partner";
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex max-w-[85%] flex-col md:max-w-[70%]",
                            isPartner ? "self-end" : "self-start",
                          )}
                        >
                          <div
                            className={cn(
                              "mb-1 flex items-center gap-2 px-1 text-[10px]",
                              isPartner ? "justify-end" : "justify-start",
                            )}
                          >
                            {!isPartner && (
                              <span className="font-bold text-zinc-600 dark:text-zinc-300">
                                Safaar ma'muriyati
                              </span>
                            )}
                            <span className="text-[var(--muted-foreground)] opacity-75">
                              {new Date(message.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isPartner && (
                              <span className="font-bold text-brand-600 dark:text-brand-400">
                                Siz
                              </span>
                            )}
                          </div>
                          <div
                            className={cn(
                              "rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm",
                              isPartner
                                ? "rounded-tr-sm bg-brand-600 text-white"
                                : "rounded-tl-sm border border-[var(--border)] bg-white text-[var(--foreground)] dark:bg-zinc-900",
                            )}
                          >
                            {message.body}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Xabar yozish formasi */}
              <div className="border-t border-[var(--border)] bg-[var(--surface)] p-3 md:p-4">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <Input
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="Xabar yozing..."
                    disabled={activeTicket.status === "closed"}
                    className="h-11 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-sm focus:border-brand-500 focus:bg-[var(--surface)]"
                  />
                  <Button
                    type="submit"
                    disabled={
                      !newMessageText.trim() ||
                      sendMessageMutation.isPending ||
                      activeTicket.status === "closed"
                    }
                    loading={sendMessageMutation.isPending}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Send className="ml-0.5 h-4 w-4" />
                  </Button>
                </form>
                {activeTicket.status === "closed" && (
                  <p className="mt-1.5 text-center text-[11px] text-zinc-400">
                    Bu murojaat yopilgan. Yangi masala uchun yangi murojaat oching.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState
                icon={<Headset className="h-10 w-10 text-[var(--muted-foreground)]" />}
                title="Murojaat tanlanmagan"
                description="Chap paneldan murojaatni tanlang yoki yangi murojaat yarating."
                action={
                  <Button onClick={() => setNewTicketOpen(true)} size="sm">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Yangi murojaat
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Yangi murojaat yaratish dialogi */}
      <Dialog
        open={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
        title="Yangi murojaat yaratish"
        description="Savol yoki muammoingiz haqida batafsil ma'lumot bering."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewTicketOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={handleCreateTicketSubmit}
              loading={createTicketMutation.isPending}
              disabled={!newTicketSubject.trim()}
            >
              Yaratish
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateTicketSubmit} className="flex flex-col gap-4 py-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Mavzu (Murojaat sarlavhasi) *
            </label>
            <Input
              value={newTicketSubject}
              onChange={(e) => setNewTicketSubject(e.target.value)}
              placeholder="Masalan: To'lov tizimi integratsiyasi bo'yicha savol"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Muhimlik darajasi
            </label>
            <select
              aria-label="Muhimlik darajasi"
              value={newTicketPriority}
              onChange={(e) => setNewTicketPriority(e.target.value as SupportTicket["priority"])}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="low">Past</option>
              <option value="medium">O'rta (Odatiy)</option>
              <option value="high">Yuqori</option>
              <option value="urgent">Shoshilinch</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Dastlabki xabar (Ixtiyoriy)
            </label>
            <textarea
              value={newTicketInitialMessage}
              onChange={(e) => setNewTicketInitialMessage(e.target.value)}
              placeholder="Muammo yoki savolingizni batafsil tushuntiring..."
              rows={4}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
