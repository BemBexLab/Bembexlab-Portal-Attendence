import { ExecutionContext, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { CurrentUser } from '../types/current-user.type';

const ISOLATED_ENVIRONMENT_USER: CurrentUser = {
  id: '00000000-0000-0000-0000-000000000000',
  organizationId: null,
  employeeId: null,
  email: 'isolated-environment@bembex.local',
  name: 'Isolated Environment Admin',
  role: UserRole.SUPER_ADMIN,
};

@Injectable()
export class JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
    request.user = ISOLATED_ENVIRONMENT_USER;
    return true;
  }
}
