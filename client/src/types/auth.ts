export type UserRole = "SUPER_ADMIN" | "ORG_ADMIN" | "HR_MANAGER" | "EMPLOYEE";

export type AuthUser = {
  id: string;
  organizationId: string | null;
  employeeId?: string | null;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthResponse = {
  user: AuthUser;
};
