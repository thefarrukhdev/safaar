"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { X, Send, Headset, User, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  loadSupportThreadAction,
  sendSupportMessageAction,
  type SupportChatMessage,
  type SupportThreadResult,
} from "@/lib/services/support/actions";
import { useRealtimeEvent } from "@/lib/services/realtime/socket-provider";
import type { CommonDict } from "@/i18n/dictionaries";

function formatMessageTime(createdAt: string): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveSupportWidget({ dict }: { dict?: CommonDict["chat"] }) {
  const params = useParams<{ lang?: string }>();
  const locale = params.lang || "uz";
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | undefined>();
  const [ticketStatus, setTicketStatus] = useState<string | undefined>();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const applyResult = useCallback(
    (result: SupportThreadResult) => {
      setAuthRequired(result.authRequired === true);

      if (!result.ok) {
        setError(
          result.authRequired
            ? dict?.loginRequired || "Xabar yuborish uchun akkauntga kiring."
            : result.error || dict?.sendError || "Xatolik",
        );
        return;
      }

      setError(null);
      setTicketId(result.ticketId);
      setTicketStatus(result.status);
      setMessages(result.messages);
    },
    [dict],
  );

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      applyResult(await loadSupportThreadAction());
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    if (open && !loaded) {
      void loadThread();
    }
  }, [open, loaded, loadThread]);

  // Operator javob yozganda widget'ni sahifani yangilamasdan yangilaydi.
  useRealtimeEvent(
    "support.message_created",
    () => {
      if (loaded) void loadThread();
    },
    [loaded, loadThread],
  );

  useEffect(() => {
    if (open && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleSend = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const message = inputText.trim();
      if (!message) return;

      setSending(true);
      try {
        const result = await sendSupportMessageAction({
          ticketId,
          message,
        });
        applyResult(result);
        if (result.ok) setInputText("");
      } finally {
        setSending(false);
      }
    },
    [applyResult, inputText, ticketId],
  );

  const loginHref = `/${locale}/login?next=${encodeURIComponent(`/${locale}`)}`;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={dict?.supportAria || "Qo'llab-quvvatlash"}
          aria-expanded={open}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-2xl transition-all duration-300 hover:bg-primary-600 hover:scale-105 hover:shadow-primary-500/30 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/40"
        >
          {open ? (
            <X className="h-6 w-6 stroke-[2.5]" />
          ) : (
            <Headset className="h-7 w-7 stroke-[2]" />
          )}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={dict?.supportAria || "Safaar qo'llab-quvvatlash"}
          className="fixed bottom-24 right-4 z-50 flex h-[520px] max-h-[85vh] w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200 dark:border-slate-800 dark:bg-slate-900/95 sm:right-6 sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white shadow-md">
                <Headset className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {dict?.supportAria || "Safaar Support"}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {authRequired
                    ? dict?.loginNeeded || "Kirish kerak"
                    : ticketId
                      ? `Ticket ${ticketId.slice(0, 8)}${ticketStatus ? ` · ${ticketStatus}` : ""}`
                      : dict?.newTicket || "Yangi murojaat"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void loadThread()}
                disabled={loading}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={dict?.refreshAria || "Yangilash"}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={dict?.closeAria || "Yopish"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {loading && messages.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                {dict?.loadingTickets || "Ticketlar yuklanmoqda..."}
              </p>
            ) : messages.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                {dict?.emptyTicketPrompt || "Yangi murojaat uchun savolingizni yozing."}
              </p>
            ) : (
              messages.map((message) => {
                const isUser = message.sender === "user";
                const time = formatMessageTime(message.createdAt);
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
                        <Headset className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[78%] rounded-xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? "rounded-br-xs bg-primary-500 font-medium text-white"
                          : "rounded-bl-xs border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <p>{message.text}</p>
                      {time && (
                        <span
                          className={`mt-1 block text-[10px] font-normal ${
                            isUser ? "text-primary-100" : "text-slate-400"
                          }`}
                        >
                          {time}
                        </span>
                      )}
                    </div>

                    {isUser && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}

            {authRequired && (
              <a
                href={loginHref}
                className="inline-flex w-fit rounded-xl bg-primary-500 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-600"
              >
                {dict?.loginBtn || "Login"}
              </a>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-slate-100 bg-card p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <input
              type="text"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={dict?.inputPlaceholder || "Xabaringizni yozing..."}
              disabled={sending || authRequired}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={sending}
              disabled={!inputText.trim() || authRequired}
              className="h-9 w-9 shrink-0 rounded-xl p-0"
              aria-label={dict?.sendAria || "Yuborish"}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
