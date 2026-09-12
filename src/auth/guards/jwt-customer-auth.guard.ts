import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { assertAuthenticated } from './public-route.util';

/**
 * Sempre exige um JWT de cliente válido, mesmo em rotas marcadas com
 * @Public() — esse decorator serve apenas para dispensar o JwtAuthGuard
 * (staff) global, não a autenticação de cliente.
 */
@Injectable()
export class JwtCustomerAuthGuard extends AuthGuard('jwt-customer') {
  handleRequest<TUser = unknown>(err: Error | null, user: TUser): TUser {
    return assertAuthenticated(err, user);
  }
}
