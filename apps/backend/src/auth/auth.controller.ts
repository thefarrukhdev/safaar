import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@safaar/types';
import type { Request, Response } from 'express';
import { CurrentActor, type RequestActor } from '../common/actor';
import { EmailOtpThrottleGuard } from '../common/email-throttle.guard';
import { PhoneOtpThrottleGuard } from '../common/phone-throttle.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AuthService } from './auth.service';
import {
  AdminLoginDto,
  CompleteOAuthRegistrationDto,
  CompleteProfileDto,
  ForgotPasswordDto,
  LoginDto,
  OAuthExchangeDto,
  OAuthTokenDto,
  PartnerEmailOtpRequestDto,
  PartnerEmailOtpVerifyDto,
  PartnerPasswordLoginDto,
  PartnerSetPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SendOtpDto,
  TotpSetupConfirmDto,
  UserForgotPasswordDto,
  UserLoginDto,
  UserResetPasswordDto,
  UserVerifyResetCodeDto,
  Verify2faDto,
  VerifyOtpRequestDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('user/send-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(PhoneOtpThrottleGuard)
  requestUserOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendUserOtp(dto.phone);
  }

  @Post('user/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyUserOtp(@Body() dto: VerifyOtpRequestDto) {
    return this.authService.verifyUserOtp(dto);
  }

  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(PhoneOtpThrottleGuard)
  requestOtpAlias(@Body() dto: SendOtpDto) {
    return this.authService.sendPartnerOtp(dto.phone);
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyOtpAlias(@Body() dto: VerifyOtpRequestDto) {
    return this.authService.verifyPartnerOtp(dto);
  }

  @Post('user/complete-profile')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  completeProfile(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(
      actor,
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('user/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  userLogin(@Body() body: UserLoginDto) {
    return this.authService.userLogin(
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('user/forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(PhoneOtpThrottleGuard)
  userForgotPassword(@Body() body: UserForgotPasswordDto) {
    return this.authService.userForgotPassword(body.phone);
  }

  @Post('user/verify-reset-code')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  userVerifyResetCode(@Body() body: UserVerifyResetCodeDto) {
    return this.authService.userVerifyPasswordResetCode({
      phone: body.phone,
      code: body.code,
      challenge_id: body.challenge_id,
    });
  }

  @Post('user/reset-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  userResetPassword(@Body() body: UserResetPasswordDto) {
    return this.authService.userResetPassword({
      phone: body.phone,
      code: body.code,
      challenge_id: body.challenge_id,
      reset_token: body.reset_token,
      password: body.password,
    });
  }

  @Get('providers')
  providers() {
    return this.authService.oauthProviders();
  }

  @Get('google')
  googleRedirect(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    return this.startOAuth('google', query, response);
  }

  @Get('google/callback')
  googleCallback(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.finishOAuth('google', query, request, response);
  }

  @Post('google/token')
  googleToken(@Body() body: OAuthTokenDto) {
    return this.authService.oauthToken(
      'google',
      body as unknown as Record<string, unknown>,
    );
  }

  @Get('facebook')
  facebookRedirect(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    return this.startOAuth('facebook', query, response);
  }

  @Get('facebook/callback')
  facebookCallback(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.finishOAuth('facebook', query, request, response);
  }

  @Post('facebook/token')
  facebookToken(@Body() body: OAuthTokenDto) {
    return this.authService.oauthToken(
      'facebook',
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('oauth/exchange')
  oauthExchange(@Body() body: OAuthExchangeDto) {
    return this.authService.oauthExchange(body.code);
  }

  @Post('oauth/register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  completeOAuthRegistration(@Body() body: CompleteOAuthRegistrationDto) {
    return this.authService.completeOAuthRegistration(body);
  }

  @Get('social-accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  socialAccounts(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.socialAccounts(actor);
  }

  @Delete('social-accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  unlinkSocialAccount(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.authService.unlinkSocialAccount(actor, id);
  }

  @Post('partner/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  partnerLogin(@Body() body: LoginDto) {
    return this.authService.partnerLogin(
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('partner/phone-login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  partnerPhoneLogin(@Body() body: Record<string, unknown>) {
    return this.authService.partnerPhoneLogin(body);
  }

  @Post('partner/forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(PhoneOtpThrottleGuard)
  partnerForgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.passwordResetRequest(
      'partner',
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('partner/reset-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  partnerResetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.passwordResetConfirm(
      'partner',
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('partner/password-login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  partnerPasswordLogin(@Body() body: PartnerPasswordLoginDto) {
    return this.authService.partnerPasswordLogin(
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('partner/set-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  partnerSetPassword(@Body() body: PartnerSetPasswordDto) {
    return this.authService.partnerSetPassword(
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('partner/email-otp/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(EmailOtpThrottleGuard)
  requestPartnerEmailOtp(@Body() body: PartnerEmailOtpRequestDto) {
    return this.authService.partnerEmailOtpRequest(body.email);
  }

  @Post('partner/email-otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyPartnerEmailOtp(@Body() body: PartnerEmailOtpVerifyDto) {
    return this.authService.partnerEmailOtpVerify(
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('admin/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  adminLogin(@Body() body: AdminLoginDto) {
    return this.authService.adminLogin(
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('admin/verify-2fa')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  adminVerify2fa(@Body() body: Verify2faDto) {
    return this.authService.adminVerify2fa(
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('admin/2fa/setup')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  admin2faSetup(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.admin2faSetup(actor);
  }

  @Post('admin/2fa/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  admin2faConfirm(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: TotpSetupConfirmDto,
  ) {
    return this.authService.admin2faConfirm(
      actor,
      body as unknown as Record<string, unknown>,
    );
  }

  @Post('admin/2fa/disable')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  admin2faDisable(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.admin2faDisable(actor);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body as unknown as Record<string, unknown>);
  }

  @Post('user/refresh')
  userRefresh(@Body() body: RefreshTokenDto) {
    return this.refresh(body);
  }

  @Post('partner/refresh')
  partnerRefresh(@Body() body: RefreshTokenDto) {
    return this.refresh(body);
  }

  @Post('admin/refresh')
  adminRefresh(@Body() body: RefreshTokenDto) {
    return this.refresh(body);
  }

  @Post('logout')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  logout(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.logout(actor);
  }

  @Post('user/logout')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  userLogout(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.logout(actor);
  }

  @Post('partner/logout')
  @UseGuards(RolesGuard)
  @Roles(Role.PARTNER)
  partnerLogout(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.logout(actor);
  }

  @Post('admin/logout')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  adminLogout(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.logout(actor);
  }

  @Post('logout-all')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  logoutAll(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.logoutAll(actor);
  }

  @Get('sessions')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  sessions(@CurrentActor() actor: RequestActor | undefined) {
    return this.authService.sessions(actor);
  }

  @Delete('sessions/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  revokeSession(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.authService.revokeSession(actor, id);
  }

  private async startOAuth(
    provider: 'google' | 'facebook',
    query: Record<string, unknown>,
    response: Response,
  ) {
    const result = await this.authService.oauthRedirect(provider, query);
    response.cookie(this.oauthCookieName(provider), result.state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60_000,
      path: '/',
    });
    response.cookie(
      this.oauthReturnCookieName(provider),
      JSON.stringify({
        locale: this.oauthLocale(query['locale']),
        next: this.safeNext(query['next']),
        // `result.origin` — servis allaqachon allow-list bo'yicha
        // tasdiqlagan qiymat (userdan kelgan xom `query['origin']` emas).
        origin: result.origin,
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60_000,
        path: '/',
      },
    );
    return response.redirect(302, result.redirectUrl);
  }

  private async finishOAuth(
    provider: 'google' | 'facebook',
    query: Record<string, unknown>,
    request: Request,
    response: Response,
  ) {
    const cookieName = this.oauthCookieName(provider);
    const returnCookieName = this.oauthReturnCookieName(provider);
    const fallback = this.oauthReturnContext(
      this.cookieValue(request.headers.cookie, returnCookieName),
    );
    try {
      const result = await this.authService.oauthCallback(
        provider,
        query,
        this.cookieValue(request.headers.cookie, cookieName),
      );
      response.clearCookie(cookieName, { path: '/' });
      response.clearCookie(returnCookieName, { path: '/' });
      const target = new URL(
        `/${result.locale}/auth/social-callback`,
        result.origin,
      );
      target.searchParams.set('code', result.code);
      if (result.next) target.searchParams.set('next', result.next);
      return response.redirect(302, target.toString());
    } catch (error) {
      response.clearCookie(cookieName, { path: '/' });
      response.clearCookie(returnCookieName, { path: '/' });
      const target = new URL(`/${fallback.locale}/login`, fallback.origin);
      target.searchParams.set('socialError', this.oauthErrorCode(error));
      if (fallback.next) target.searchParams.set('next', fallback.next);
      return response.redirect(302, target.toString());
    }
  }

  private oauthCookieName(provider: 'google' | 'facebook'): string {
    return `safaar_oauth_${provider}_state`;
  }

  private oauthReturnCookieName(provider: 'google' | 'facebook'): string {
    return `safaar_oauth_${provider}_return`;
  }

  private cookieValue(header: string | undefined, name: string) {
    if (!header) return undefined;
    for (const item of header.split(';')) {
      const [key, ...value] = item.trim().split('=');
      if (key === name) return decodeURIComponent(value.join('='));
    }
    return undefined;
  }

  private webUserUrl(): string {
    return process.env.WEB_USER_URL ?? 'http://localhost:3000';
  }

  /**
   * Faqat `OAUTH_ALLOWED_ORIGINS` (yoki yagona `WEB_USER_URL`)dagi aniq
   * origin'lar qabul qilinadi — bu return-cookie o'qilganda ham qayta
   * tekshiriladi (cookie qiymati brauzer tomonida, ya'ni ishonchsiz manba
   * hisoblanadi), xuddi locale/next allaqachon shunday qayta tekshirilgani
   * kabi. Noma'lum/soxta qiymat hech qachon ishlatilmaydi (open redirect
   * oldini olish).
   */
  private allowedOAuthOrigins(): string[] {
    const primary = this.webUserUrl().replace(/\/$/, '');
    const raw = process.env.OAUTH_ALLOWED_ORIGINS;
    if (!raw) return [primary];
    const origins = raw
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean);
    return origins.length > 0 ? origins : [primary];
  }

  private oauthOrigin(value: unknown): string {
    const allowed = this.allowedOAuthOrigins();
    const candidate = String(value ?? '')
      .trim()
      .replace(/\/$/, '');
    return allowed.includes(candidate) ? candidate : allowed[0];
  }

  private oauthReturnContext(value: string | undefined): {
    locale: 'uz' | 'ru' | 'en';
    next: string;
    origin: string;
  } {
    try {
      const parsed = JSON.parse(value ?? '{}') as Record<string, unknown>;
      return {
        locale: this.oauthLocale(parsed['locale']),
        next: this.safeNext(parsed['next']),
        origin: this.oauthOrigin(parsed['origin']),
      };
    } catch {
      return { locale: 'uz', next: '', origin: this.webUserUrl() };
    }
  }

  private oauthLocale(value: unknown): 'uz' | 'ru' | 'en' {
    return value === 'ru' || value === 'en' ? value : 'uz';
  }

  private safeNext(value: unknown): string {
    const next = String(value ?? '');
    return next.startsWith('/') && !next.startsWith('//') ? next : '';
  }

  private oauthErrorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (response && typeof response === 'object' && 'code' in response) {
        return String((response as { code?: unknown }).code ?? 'OAUTH_FAILED');
      }
    }
    return 'OAUTH_FAILED';
  }
}
