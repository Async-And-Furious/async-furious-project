import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export function isPublicRoute(reflector: Reflector, context: ExecutionContext): boolean {
  return !!reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
}

export function assertAuthenticated<TUser>(err: Error | null, user: TUser): TUser {
  if (err || !user) {
    throw err || new UnauthorizedException('Autenticação necessária');
  }
  return user;
}
