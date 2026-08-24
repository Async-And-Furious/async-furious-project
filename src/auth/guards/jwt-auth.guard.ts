import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { isPublicRoute, assertAuthenticated } from './public-route.util';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: Error | null, user: TUser): TUser {
    return assertAuthenticated(err, user);
  }
}
