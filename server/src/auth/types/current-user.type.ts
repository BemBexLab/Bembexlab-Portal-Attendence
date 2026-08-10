import { UserRole } from '@prisma/client';

export type CurrentUser = {
  id: string;
  organizationId: string | null;
  employeeId: string | null;
  email: string;
  name: string;
  role: UserRole;
};
