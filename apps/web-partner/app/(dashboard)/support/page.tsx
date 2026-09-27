"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Headset } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../../_components/layout/page-header";
import { Button } from "../../_components/ui/button";
import { Input } from "../../_components/ui/input";
import { support } from "../../_lib/api";
import { useAuthStore } from "../../_stores/auth-store";

const ticketsQueryKey = ["partner", "support", "tickets"] as const;

export default function SupportPage() {
  const accessToken = useAuthStore((state) => state.tokens?.accessToken);
  const queryClient = useQueryClient();
  const [newMessageText, setNewMessageText] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const ticketsQuery = useQuery({
    queryKey: ticketsQueryKey,
    queryFn: () => support.listTickets(accessToken),
    enabled: Boolean(accessToken),
  });
  const ticketId = ticketsQuery.data?.[0]?.id;
  const ticketQuery = useQuery({
    queryKey: ["partner", "support", "ticket", ticketId],
    queryFn: () => support.getTicket(ticketId ?? "", accessToken),
    enabled: Boolean(accessToken && ticketId),
  });
  const messages = useMemo(
    () => ticketQuery.data?.messages ?? [],
    [ticketQuery.data?.messages],
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      let currentTicketId = ticketId;
      if (!currentTicketId) {
        const ticket = await support.createTicket(
          {
            subject: text.slice(0, 80),
            priority: "medium",
          },
          accessToken,
        );
        currentTicketId = ticket.id;
      }
      await support.sendMessage(currentTicketId, text, accessToken);
      return currentTicketId;
    },
    onSuccess: (currentTicketId) => {
      setNewMessageText("");
      void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
      void queryClient.invalidateQueries({
        queryKey: ["partner", "support", "ticket", currentTicketId],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Xabar yuborilmadi");
    },
  });

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const text = newMessageText.trim();
    if (!text) return;
    sendMessage.mutate(text);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-120px)] w-full max-w-5xl flex-col overflow-hidden">
      <PageHeader
        title="Yordam markazi"
        description="Safaar ma'muriyati bilan bevosita bog'lanish. Barcha savollaringizni shu yerda yozishingiz mumkin."
      />

      <div className="relative mb-6 mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex flex-col gap-1 border-b border-[var(--border)] bg-[var(--surface-muted)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Headset className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Safaar ma'muriyati
              </h3>
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                Texnik yordam va savollar uchun
              </p>
            </div>
          </div>
        </div>

        <div
          ref={chatContainerRef}
          className="custom-scrollbar flex-1 overflow-y-auto bg-[#f8f9fa] p-4 md:p-6"
        >
          {ticketsQuery.isLoading || ticketQuery.isLoading ? (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              Xabarlar yuklanmoqda...
            </p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              Hali xabar yo'q.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((message) => {
                const isPartner = message.sender_type === "partner";
                return (
                  <div
                    key={message.id}
                    className={`flex max-w-[85%] flex-col md:max-w-[70%] ${
                      isPartner ? "self-end" : "self-start"
                    }`}
                  >
                    <div
                      className={`mb-1 flex items-center gap-2 px-1 ${
                        isPartner ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isPartner && (
                        <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                          Safaar admin
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-[var(--muted-foreground)] opacity-70">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isPartner && (
                        <span className="text-[11px] font-bold text-brand-600">
                          Siz
                        </span>
                      )}
                    </div>
                    <div
                      className={`rounded-2xl p-3.5 text-[15px] leading-relaxed shadow-sm md:p-4 ${
                        isPartner
                          ? "rounded-tr-sm bg-brand-600 text-white"
                          : "rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                      }`}
                    >
                      {message.body}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <Input
              value={newMessageText}
              onChange={(event) => setNewMessageText(event.target.value)}
              placeholder="Xabar yozing..."
              className="h-[52px] w-full rounded-full border border-[var(--border)] bg-[var(--surface-muted)] pl-6 pr-14 text-sm focus:border-brand-500 focus:bg-[var(--surface)] focus:ring-1 focus:ring-brand-500"
            />
            <Button
              type="submit"
              disabled={!newMessageText.trim() || sendMessage.isPending}
              loading={sendMessage.isPending}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full p-0 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            >
              <Send className="ml-1 h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
