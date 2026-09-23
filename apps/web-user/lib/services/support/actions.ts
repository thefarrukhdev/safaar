"use server";

import { api, ApiRequestError } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import type { SupportMessageView, SupportTicketView } from "@/types/view";

export interface SupportChatMessage {
  id: string;
  sender: "user" | "support";
  text: string;
  createdAt: string;
}

export interface SupportThreadResult {
  ok: boolean;
  authRequired?: boolean;
  error?: string;
  ticketId?: string;
  status?: string;
  messages: SupportChatMessage[];
}

function mapMessage(message: SupportMessageView): SupportChatMessage {
  return {
    id: message.id,
    sender: message.senderType === "user" ? "user" : "support",
    text: message.body,
    createdAt: message.createdAt,
  };
}

function threadFromTicket(ticket: SupportTicketView): SupportThreadResult {
  return {
    ok: true,
    ticketId: ticket.id,
    status: ticket.status,
    messages: (ticket.messages ?? []).map(mapMessage),
  };
}

function supportError(error: unknown): SupportThreadResult {
  return {
    ok: false,
    error: error instanceof ApiRequestError ? error.message : "ERROR",
    messages: [],
  };
}

export async function loadSupportThreadAction(): Promise<SupportThreadResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, authRequired: true, messages: [] };
  }

  try {
    const tickets = await api.support.listTickets({ token: session.accessToken });
    const ticket =
      tickets.find((item) => item.status !== "closed") ?? tickets[0];
    if (!ticket) {
      return { ok: true, messages: [] };
    }

    const detail = await api.support.getTicket(ticket.id, {
      token: session.accessToken,
    });
    return threadFromTicket(detail);
  } catch (error) {
    return supportError(error);
  }
}

export async function sendSupportMessageAction(input: {
  ticketId?: string;
  message: string;
}): Promise<SupportThreadResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, authRequired: true, messages: [] };
  }

  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: "EMPTY_MESSAGE", messages: [] };
  }

  try {
    const ticketId =
      input.ticketId ||
      (
        await api.support.createTicket(
          {
            subject: message.slice(0, 80),
            priority: "medium",
          },
          { token: session.accessToken },
        )
      ).id;

    await api.support.sendMessage(
      ticketId,
      { body: message },
      { token: session.accessToken },
    );

    const detail = await api.support.getTicket(ticketId, {
      token: session.accessToken,
    });
    return threadFromTicket(detail);
  } catch (error) {
    return supportError(error);
  }
}

export async function sendGuestSupportTicketAction(input: {
  message: string;
  guestName: string;
  guestPhone: string;
}): Promise<{ ok: boolean; error?: string }> {
  const message = input.message.trim();
  const guestName = input.guestName.trim();
  const guestPhone = input.guestPhone.trim();

  if (!message || !guestName || !guestPhone) {
    return { ok: false, error: "MISSING_FIELDS" };
  }

  try {
    await api.support.createGuestTicket({ message, guestName, guestPhone });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiRequestError ? error.message : "ERROR",
    };
  }
}
