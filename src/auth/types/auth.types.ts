import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: Role;
  cpf?: string;
  documento?: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

// Keep AuthUser for backwards compat (deprecated - use AuthenticatedUser)
export type AuthUser = AuthenticatedUser;

export interface AuthRequest {
  user?: AuthenticatedUser;
}
