import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUserDecorator } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { CurrentUser } from './types/current-user.type';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    response.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...this.getCookieOptions(),
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });

    return {
      user: result.user,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUserDecorator() user: CurrentUser) {
    return {
      user,
    };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.getCookieOptions());
  }

  private getCookieOptions() {
    const secure =
      this.configService.get<string>('COOKIE_SECURE') === 'true' ||
      (this.configService.get<string>('COOKIE_SECURE') !== 'false' &&
        this.configService.get<string>('NODE_ENV') === 'production');

    return {
      httpOnly: true,
      secure,
      sameSite: secure ? ('none' as const) : ('lax' as const),
      path: '/',
    };
  }
}
