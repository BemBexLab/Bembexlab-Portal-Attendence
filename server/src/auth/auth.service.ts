import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.type';
import type { CurrentUser } from './types/current-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: await this.issueAccessToken(user),
      user: this.usersService.toSafeUser(user),
    };
  }

  issueAccessToken(
    user: Pick<CurrentUser, 'id' | 'organizationId' | 'email' | 'role'>,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload);
  }
}
