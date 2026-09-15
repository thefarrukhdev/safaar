import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Yangi parol o'rnatiladigan barcha joylarda (ro'yxatdan o'tish, parolni
 * tiklash) qo'llaniladi — LOGIN uchun emas (login'da mavjud parol shunchaki
 * tekshiriladi, uzunlik/murakkablik talabi u yerga tegishli emas).
 */
function IsStrongPassword() {
  return function (target: object, propertyKey: string) {
    MinLength(8, {
      message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak",
    })(target, propertyKey);
    Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
      message: 'Parolda kamida bitta harf va bitta raqam bo‘lishi kerak',
    })(target, propertyKey);
  };
}

export class SendOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class VerifyOtpRequestDto extends SendOtpDto {
  @ApiPropertyOptional({ example: 'otp-challenge-id' })
  @IsOptional()
  @IsString()
  challenge_id?: string;

  @ApiPropertyOptional({ example: 'challenge-id' })
  @IsOptional()
  @IsString()
  chalenge_id?: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class CompleteProfileDto {
  @ApiPropertyOptional({ example: 'Laziz' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Shakarov' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'user@safaar.uz' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'P@ssw0rd!' })
  @IsOptional()
  @IsString()
  @IsStrongPassword()
  password?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      "Ommaviy Oferta (Terms of Service)ga rozilik — ro'yxatdan o'tishni " +
      'yakunlash uchun majburiy `true` bo‘lishi kerak.',
  })
  @IsOptional()
  @IsBoolean()
  agree_terms?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  agreeTerms?: boolean;

  @ApiPropertyOptional({ enum: ['uz', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  preferred_language?: 'uz' | 'ru' | 'en';
}

export class OAuthTokenDto {
  @ApiPropertyOptional({ example: 'google-user-id' })
  @IsOptional()
  @IsString()
  provider_user_id?: string;

  @ApiPropertyOptional({ example: 'user@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class OAuthExchangeDto {
  @ApiProperty({ example: 'one-time-oauth-code' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class CompleteOAuthRegistrationDto {
  @ApiProperty({ example: 'google' })
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty({ example: 'one-time-oauth-registration-token' })
  @IsString()
  @IsNotEmpty()
  registration_token!: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ example: 'otp-challenge-id' })
  @IsOptional()
  @IsString()
  challenge_id?: string;

  @ApiPropertyOptional({ example: 'Aziz' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Karimov' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Ommaviy Oferta (Terms of Service)ga rozilik — majburiy `true` bo‘lishi kerak.',
  })
  @IsOptional()
  @IsBoolean()
  agree_terms?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  agreeTerms?: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'partner@safaar.uz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UserLoginDto {
  @ApiProperty({ example: 'user@safaar.uz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UserForgotPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class UserVerifyResetCodeDto extends VerifyOtpRequestDto {}

export class UserResetPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: '482913' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string;

  @ApiPropertyOptional({ example: 'otp-challenge-id' })
  @IsOptional()
  @IsString()
  challenge_id?: string;

  @ApiPropertyOptional({ example: 'one-time-reset-token' })
  @IsOptional()
  @IsString()
  reset_token?: string;

  @ApiProperty({ example: 'N3wP@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  password!: string;
}

export class AdminLoginDto {
  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  @ApiPropertyOptional({ example: 'admin@safaar.uz' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ example: 'otp-challenge-id' })
  @IsOptional()
  @IsString()
  challenge_id?: string;

  @ApiProperty({ example: 'N3wP@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  password!: string;
}

export class PartnerEmailOtpRequestDto {
  @ApiProperty({ example: 'partner@safaar.uz' })
  @IsEmail()
  email!: string;
}

export class PartnerEmailOtpVerifyDto {
  @ApiProperty({ example: 'partner@safaar.uz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ example: 'otp-challenge-id' })
  @IsOptional()
  @IsString()
  challenge_id?: string;
}

export class PartnerPasswordLoginDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class PartnerSetPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ example: 'otp-challenge-id' })
  @IsOptional()
  @IsString()
  challenge_id?: string;

  @ApiProperty({ example: 'N3wP@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  password!: string;
}

export class Verify2faDto {
  @ApiPropertyOptional({ example: 'challenge-id' })
  @IsOptional()
  @IsString()
  challenge_id?: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  refresh_token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class TotpSetupConfirmDto {
  @ApiProperty({ example: 'setup-id' })
  @IsString()
  @IsNotEmpty()
  setup_id!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
