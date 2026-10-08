/* eslint-disable @typescript-eslint/unbound-method */
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { RequestActor } from '../common/actor';
import { Role } from '@safaar/types';

describe('AuthController — Partner Auth & Cookie Security', () => {
  type MockAuthService = {
    [K in keyof AuthService]?: jest.Mock;
  };
  let controller: AuthController;
  let authServiceMock: MockAuthService;

  const mockResponse = () => {
    const res: Partial<Response> = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    return res as Response;
  };

  const mockRequest = (options?: {
    cookies?: Record<string, string>;
    cookieHeader?: string;
  }) => {
    return {
      cookies: options?.cookies,
      headers: {
        cookie: options?.cookieHeader,
      },
    } as unknown as Request;
  };

  beforeEach(() => {
    authServiceMock = {
      partnerLogin: jest.fn(),
      partnerPhoneLogin: jest.fn(),
      partnerPasswordLogin: jest.fn(),
      partnerSetPassword: jest.fn(),
      partnerEmailOtpVerify: jest.fn(),
      verifyPartnerOtp: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    controller = new AuthController(authServiceMock as unknown as AuthService);
  });

  describe('Partner login endpoints set HttpOnly refresh_token cookie', () => {
    it('partnerLogin sets secure cookie and returns tokens', async () => {
      authServiceMock.partnerLogin!.mockResolvedValue({
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        organization_id: 'org-1',
      });

      const res = mockResponse();
      const result = await controller.partnerLogin(
        { email: 'partner@test.com', password: 'pass' },
        res,
      );

      expect(authServiceMock.partnerLogin).toHaveBeenCalledWith({
        email: 'partner@test.com',
        password: 'pass',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-123',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'refresh-123');
    });

    it('partnerPasswordLogin sets secure cookie and returns tokens', async () => {
      authServiceMock.partnerPasswordLogin!.mockResolvedValue({
        accessToken: 'access-456',
        refreshToken: 'refresh-456',
      });

      const res = mockResponse();
      const result = await controller.partnerPasswordLogin(
        { email: 'partner@test.com', password: 'pass' } as never,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-456',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'refresh-456');
    });

    it('verifyPartnerEmailOtp sets secure cookie and returns tokens', async () => {
      authServiceMock.partnerEmailOtpVerify!.mockResolvedValue({
        accessToken: 'access-789',
        refreshToken: 'refresh-789',
      });

      const res = mockResponse();
      const result = await controller.verifyPartnerEmailOtp(
        { email: 'partner@test.com', code: '123456' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-789',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'refresh-789');
    });

    it('partnerPhoneLogin sets secure cookie and returns tokens', async () => {
      authServiceMock.partnerPhoneLogin!.mockResolvedValue({
        accessToken: 'access-phone',
        refreshToken: 'refresh-phone',
      });

      const res = mockResponse();
      const result = await controller.partnerPhoneLogin(
        { phone: '+998901234567', code: '123456' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-phone',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'refresh-phone');
    });

    it('partnerSetPassword sets secure cookie and returns tokens', async () => {
      authServiceMock.partnerSetPassword!.mockResolvedValue({
        accessToken: 'access-set-pw',
        refreshToken: 'refresh-set-pw',
      });

      const res = mockResponse();
      const result = await controller.partnerSetPassword(
        { phone: '+998901234567', password: 'new-password' } as never,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-set-pw',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'refresh-set-pw');
    });

    it('verifyOtpAlias sets secure cookie and returns tokens', async () => {
      authServiceMock.verifyPartnerOtp!.mockResolvedValue({
        accessToken: 'access-otp-alias',
        refreshToken: 'refresh-otp-alias',
      });

      const res = mockResponse();
      const result = await controller.verifyOtpAlias(
        { phone: '+998901234567', code: '123456' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-otp-alias',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'refresh-otp-alias');
    });
  });

  describe('Token refresh with backward compatibility and cookie support', () => {
    it('prefers refreshToken from request body if explicitly provided', async () => {
      authServiceMock.refresh!.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const req = mockRequest({ cookies: { refresh_token: 'cookie-token' } });
      const res = mockResponse();

      const result = await controller.partnerRefresh(
        { refreshToken: 'body-token' },
        req,
        res,
      );

      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'body-token',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'new-refresh');
    });

    it('falls back to req.cookies["refresh_token"] when body has no token', async () => {
      authServiceMock.refresh!.mockResolvedValue({
        accessToken: 'new-access-from-cookie',
        refreshToken: 'new-refresh-from-cookie',
      });

      const req = mockRequest({
        cookies: { refresh_token: 'cookie-token-123' },
      });
      const res = mockResponse();

      const result = await controller.partnerRefresh({}, req, res);

      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'cookie-token-123',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-from-cookie',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toHaveProperty('refreshToken', 'new-refresh-from-cookie');
    });

    it('falls back to headers.cookie when req.cookies is not populated', async () => {
      authServiceMock.refresh!.mockResolvedValue({
        accessToken: 'new-access-header',
        refreshToken: 'new-refresh-header',
      });

      const req = mockRequest({
        cookieHeader: 'other=abc; refresh_token=from-header-token; foo=bar',
      });
      const res = mockResponse();

      await controller.partnerRefresh({}, req, res);

      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'from-header-token',
        }),
      );
    });

    it('falls back to req.cookies["refresh_token"] when body token is empty string or whitespace', async () => {
      authServiceMock.refresh!.mockResolvedValue({
        accessToken: 'new-access-empty-str',
        refreshToken: 'new-refresh-empty-str',
      });

      const req = mockRequest({
        cookies: { refresh_token: 'cookie-valid-token' },
      });
      const res = mockResponse();

      await controller.partnerRefresh(
        { refreshToken: '   ', refresh_token: '' },
        req,
        res,
      );

      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'cookie-valid-token',
        }),
      );
    });

    it('supports req.cookies["refreshToken"] alongside snake_case key', async () => {
      authServiceMock.refresh!.mockResolvedValue({
        accessToken: 'new-access-camel',
        refreshToken: 'new-refresh-camel',
      });

      const req = mockRequest({
        cookies: { refreshToken: 'camel-cookie-token' },
      });
      const res = mockResponse();

      await controller.partnerRefresh({}, req, res);

      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'camel-cookie-token',
        }),
      );
    });
  });

  describe('Partner logout clears cookie', () => {
    it('partnerLogout clears refresh_token cookie and revokes session', async () => {
      authServiceMock.logout!.mockResolvedValue({
        actor_id: 'partner-1',
        logged_out: true,
      });

      const res = mockResponse();
      const actor: RequestActor = {
        id: 'partner-1',
        role: Role.PARTNER,
        roles: [Role.PARTNER],
        actorType: 'partner',
        sessionId: 'sess-1',
      };

      const result = await controller.partnerLogout(actor, res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(authServiceMock.logout).toHaveBeenCalledWith(actor);
      expect(result).toEqual({ actor_id: 'partner-1', logged_out: true });
    });
  });
});
