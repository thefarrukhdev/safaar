import { rawApi, type RequestOptions } from "../client";
import { camelizeKeys } from "../case";
import { toSupportMessageView, toSupportTicketView } from "../adapters";
import type { SupportMessageView, SupportTicketView } from "../types";

export interface CreateSupportTicketInput {
  subject: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface CreateSupportMessageInput {
  body: string;
}

export interface CreateGuestSupportTicketInput {
  message: string;
  guestName: string;
  guestPhone: string;
  subject?: string;
}

type RawSupportTicket = Parameters<typeof toSupportTicketView>[0];
type RawSupportMessage = Parameters<typeof toSupportMessageView>[0];

function authOptions(options?: { token?: string }): RequestOptions {
  return options?.token ? { token: options.token } : {};
}

export const supportService = {
  async listTickets(options?: { token?: string }): Promise<SupportTicketView[]> {
    const raw = await rawApi.get<unknown[]>("/support/tickets", authOptions(options));
    return camelizeKeys<RawSupportTicket[]>(raw).map(toSupportTicketView);
  },

  async getTicket(
    ticketId: string,
    options?: { token?: string },
  ): Promise<SupportTicketView> {
    const raw = await rawApi.get<unknown>(
      `/support/tickets/${encodeURIComponent(ticketId)}`,
      authOptions(options),
    );
    return toSupportTicketView(camelizeKeys<RawSupportTicket>(raw));
  },

  async createTicket(
    input: CreateSupportTicketInput,
    options?: { token?: string },
  ): Promise<SupportTicketView> {
    const raw = await rawApi.post<unknown>(
      "/support/tickets",
      {
        subject: input.subject,
        priority: input.priority ?? "medium",
      },
      authOptions(options),
    );
    return toSupportTicketView(camelizeKeys<RawSupportTicket>(raw));
  },

  /**
   * `POST /support/tickets/guest` — login qilmagan mehmon uchun ochiq yo'l
   * (token talab qilinmaydi).
   */
  async createGuestTicket(
    input: CreateGuestSupportTicketInput,
  ): Promise<SupportTicketView> {
    const raw = await rawApi.post<unknown>("/support/tickets/guest", {
      message: input.message,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      subject: input.subject,
    });
    return toSupportTicketView(camelizeKeys<RawSupportTicket>(raw));
  },

  async sendMessage(
    ticketId: string,
    input: CreateSupportMessageInput,
    options?: { token?: string },
  ): Promise<SupportMessageView> {
    const raw = await rawApi.post<unknown>(
      `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      { body: input.body },
      authOptions(options),
    );
    return toSupportMessageView(camelizeKeys<RawSupportMessage>(raw));
  },
};
