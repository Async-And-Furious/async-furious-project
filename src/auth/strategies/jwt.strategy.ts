import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../types/auth.types';

type JwtAlgorithm = 'HS256' | 'RS256';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private authService: AuthService
  ) {
    const algorithm = (config.get<string>('JWT_ALGORITHM') ?? 'HS256') as JwtAlgorithm;
    const verificationKey =
      algorithm === 'RS256'
        ? config.get<string>('JWT_PUBLIC_KEY')
        : config.get<string>('JWT_SECRET');
    if (!verificationKey) {
      throw new Error('JWT verification key environment variable is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: verificationKey,
      algorithms: [algorithm],
    });
  }

  async validate(payload: JwtPayload) {
    const user =
      typeof this.authService.validateTokenSubject === 'function'
        ? await this.authService.validateTokenSubject(payload)
        : await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
