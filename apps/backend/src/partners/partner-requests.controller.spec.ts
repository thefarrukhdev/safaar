import { PartnerRequestsController } from './partner-requests.controller';
import { PartnersService } from './partners.service';
import { CreatePartnerRequestDto } from './dto/create-partner-request.dto';

describe('PartnerRequestsController', () => {
  let controller: PartnerRequestsController;
  let serviceMock: jest.Mocked<Partial<PartnersService>>;

  beforeEach(() => {
    serviceMock = {
      submitPublicPartnerRequest: jest.fn(),
      publicPartnerRequestStatus: jest.fn(),
    };
    controller = new PartnerRequestsController(serviceMock as PartnersService);
  });

  it('delegates submit to partnersService.submitPublicPartnerRequest', async () => {
    const dto: CreatePartnerRequestDto = {
      type: 'hotel',
      companyName: 'Test Hotel',
      phone: '+998901234567',
      email: 'test@example.com',
      taxId: '123456789',
      password: 'StrongPassword123!',
      phoneVerificationToken: 'proof-token',
    };
    const expectedResult = { item: { id: 'req-1', status: 'submitted' } };
    (serviceMock.submitPublicPartnerRequest as jest.Mock).mockResolvedValue(
      expectedResult,
    );

    const result = await controller.submit(dto);
    expect(result).toBe(expectedResult);
    expect(serviceMock.submitPublicPartnerRequest).toHaveBeenCalledWith(dto);
  });

  it('delegates status to partnersService.publicPartnerRequestStatus', async () => {
    const expectedResult = { found: true, status: 'approved', request: null };
    (serviceMock.publicPartnerRequestStatus as jest.Mock).mockResolvedValue(
      expectedResult,
    );

    const result = await controller.status('+998901234567', 'test@example.com');
    expect(result).toBe(expectedResult);
    expect(serviceMock.publicPartnerRequestStatus).toHaveBeenCalledWith(
      '+998901234567',
      'test@example.com',
    );
  });
});
