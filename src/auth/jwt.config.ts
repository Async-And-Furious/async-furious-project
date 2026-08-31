import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export type JwtAlgorithm = 'HS256' | 'RS256';

export interface JwtContract {
  algorithm: JwtAlgorithm;
  issuer: string;
  audience: string;
  expiresIn: number;
  production: boolean;
}

export function resolveJwtContract(config: ConfigService): JwtContract {
  const production = config.get<string>('NODE_ENV') === 'production';
  const algorithm = config.get<string>('JWT_ALGORITHM') ?? (production ? undefined : 'HS256');
  const issuer =
    config.get<string>('JWT_ISSUER') ?? (production ? undefined : 'repo-auth-serverless');
  const audience =
    config.get<string>('JWT_AUDIENCE') ?? (production ? undefined : 'async-furious-project');
  const expiresInValue =
    config.get<string>('JWT_EXPIRES_IN') ??
    (!production ? (config.get<string>('JWT_EXPIRATION') ?? '1800') : undefined);
  const expiresIn = Number(expiresInValue);

  if (
    !algorithm ||
    !['HS256', 'RS256'].includes(algorithm) ||
    !issuer ||
    !audience ||
    !Number.isInteger(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error('JWT production contract is incomplete or invalid');
  }
  if (production && (algorithm !== 'RS256' || expiresIn !== 1800)) {
    throw new Error('Production JWT requires RS256 and JWT_EXPIRES_IN=1800');
  }

  return { algorithm: algorithm as JwtAlgorithm, issuer, audience, expiresIn, production };
}

export function createJwtModuleOptions(config: ConfigService): JwtModuleOptions {
  const contract = resolveJwtContract(config);
  const secret = config.get<string>('JWT_SECRET');
  const privateKey = config.get<string>('JWT_PRIVATE_KEY');

  if (contract.algorithm === 'HS256' && (!secret || contract.production)) {
    throw new Error('HS256 signing is local/test-only and requires JWT_SECRET');
  }
  if (contract.algorithm === 'RS256' && contract.production && !privateKey) {
    throw new Error('Production RS256 signing requires JWT_PRIVATE_KEY');
  }

  return {
    ...(contract.algorithm === 'RS256' ? { privateKey } : { secret }),
    signOptions: {
      algorithm: contract.algorithm,
      expiresIn: contract.expiresIn,
      issuer: contract.issuer,
      audience: contract.audience,
    },
  };
}
