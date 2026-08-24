import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../types/auth.types';
import { resolveJwtContract } from '../jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private authService: AuthService
  ) {
    const contract = resolveJwtContract(config);
    const { algorithm } = contract;
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
      issuer: contract.issuer,
      audience: contract.audience,
      maxAge: `${contract.expiresIn}s`,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub?.trim() || !payload.iss || !payload.aud || typeof payload.exp !== 'number') {
      throw new UnauthorizedException();
    }
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
