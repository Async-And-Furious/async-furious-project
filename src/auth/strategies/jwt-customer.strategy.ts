import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser, CustomerJwtPayload } from '../types/auth.types';

@Injectable()
export class JwtCustomerStrategy extends PassportStrategy(Strategy, 'jwt-customer') {
  constructor(config: ConfigService) {
    const publicKey = config.get<string>('JWT_CUSTOMER_PUBLIC_KEY');
    if (!publicKey) {
      throw new Error('JWT_CUSTOMER_PUBLIC_KEY environment variable is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey.replace(/\\n/g, '\n'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: CustomerJwtPayload): AuthenticatedUser {
    return { id: payload.sub, role: Role.CLIENTE };
  }
}
