import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private authService: AuthService
  ) {
    const gatewayMode = config.get<string>('AUTH_MODE') === 'gateway';
    const key = gatewayMode
      ? config.get<string>('JWT_PUBLIC_KEY')
      : config.get<string>('JWT_SECRET');
    if (!key)
      throw new Error(
        gatewayMode
          ? 'JWT_PUBLIC_KEY environment variable is required'
          : 'JWT_SECRET environment variable is required'
      );
    const issuer = gatewayMode ? config.get<string>('JWT_ISSUER') : undefined;
    const audience = gatewayMode ? config.get<string>('JWT_AUDIENCE') : undefined;
    if (gatewayMode && (!issuer || !audience)) {
      throw new Error('JWT_ISSUER and JWT_AUDIENCE environment variables are required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: key,
      algorithms: [gatewayMode ? 'RS256' : 'HS256'],
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    });
  }

  async validate(payload: JwtPayload) {
    if (this.config.get<string>('AUTH_MODE') === 'gateway') {
      const customer = await this.authService.validateCustomer(payload.sub);
      if (!customer) throw new UnauthorizedException('Customer does not exist');
      return customer;
    }
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
