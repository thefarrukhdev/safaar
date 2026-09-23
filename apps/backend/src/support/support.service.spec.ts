import 'reflect-metadata';
import type { RequestActor } from '../common/actor';
import { PostgresService } from '../infrastructure/postgres.service';
import { EventsService } from '../realtime/events.service';
import { SupportService } from './support.service';
import type { CreateGuestSupportTicketDto } from './dto/support.dto';

function guestDto(
  overrides: Partial<CreateGuestSupportTicketDto> = {},
): CreateGuestSupportTicketDto {
  return {
    message: 'Bron uchun to‘lov o‘tmadi',
    guestName: 'Aziza Karimova',
    guestPhone: '+998901234567',
    ...overrides,
  };
}

describe('SupportService.createGuest', () => {
  let pgMock: jest.Mocked<Pick<PostgresService, 'query'>>;
  let eventsMock: jest.Mocked<
    Pick<EventsService, 'supportTicketUpdated' | 'supportMessageCreated'>
  >;
  let service: SupportService;

  beforeEach(() => {
    pgMock = { query: jest.fn() };
    eventsMock = {
      supportTicketUpdated: jest.fn(),
      supportMessageCreated: jest.fn(),
    };
    service = new SupportService(
      pgMock as unknown as PostgresService,
      eventsMock as unknown as EventsService,
    );
  });

  it('creates a ticket + first message without requiring an actor', async () => {
    pgMock.query
      .mockResolvedValueOnce([
        { id: 'ticket-1', actor_type: 'guest', status: 'open' },
      ])
      .mockResolvedValueOnce([
        { id: 'message-1', body: 'Bron uchun to‘lov o‘tmadi' },
      ]);

    const result = (await service.createGuest(undefined, guestDto())) as {
      id: string;
      messages: unknown[];
    };

    expect(result.id).toBe('ticket-1');
    expect(result.messages).toHaveLength(1);

    const ticketInsert = pgMock.query.mock.calls[0];
    expect(ticketInsert[0]).toContain('INSERT INTO support_tickets');
    expect(ticketInsert[1]).toEqual([
      expect.any(String), // id
      null, // user_id — no actor
      expect.any(String), // guest actor id
      expect.any(String), // subject
      'Aziza Karimova',
      '+998901234567',
      expect.any(String), // created_at
    ]);

    const messageInsert = pgMock.query.mock.calls[1];
    expect(messageInsert[0]).toContain('INSERT INTO support_messages');
    expect(messageInsert[1]![3]).toBe('Bron uchun to‘lov o‘tmadi');

    expect(eventsMock.supportTicketUpdated).toHaveBeenCalled();
    expect(eventsMock.supportMessageCreated).toHaveBeenCalled();
  });

  it('links user_id when a logged-in user submits the guest form', async () => {
    pgMock.query
      .mockResolvedValueOnce([{ id: 'ticket-2' }])
      .mockResolvedValueOnce([{ id: 'message-2' }]);

    const actor: RequestActor = {
      id: 'user-42',
      actorType: 'user',
    } as RequestActor;

    await service.createGuest(actor, guestDto());

    const ticketInsert = pgMock.query.mock.calls[0];
    expect(ticketInsert[1]![1]).toBe('user-42'); // user_id populated
  });

  it('falls back to a generated subject when none is provided', async () => {
    pgMock.query
      .mockResolvedValueOnce([{ id: 'ticket-3' }])
      .mockResolvedValueOnce([{ id: 'message-3' }]);

    await service.createGuest(undefined, guestDto({ subject: undefined }));

    const ticketInsert = pgMock.query.mock.calls[0];
    expect(ticketInsert[1]![3]).toContain('Aziza Karimova');
  });
});
