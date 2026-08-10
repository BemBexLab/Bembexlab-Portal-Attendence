import { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  organizationId: string | null;
  email: string;
  role: UserRole;
};
