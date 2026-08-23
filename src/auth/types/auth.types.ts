import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// Payload emitido externamente pela Lambda de autenticação via CPF (RS256, sem role/email).
export interface CustomerJwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

// Keep AuthUser for backwards compat (deprecated - use AuthenticatedUser)
export type AuthUser = AuthenticatedUser;

export interface AuthRequest {
  user?: AuthenticatedUser;
}
