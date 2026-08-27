import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../services/auth.service';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser } from '../types/auth.types';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(() => {
    authService = {
      validateUser: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    config = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_ALGORITHM') return 'HS256';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_ISSUER') return 'repo-auth-serverless';
        if (key === 'JWT_AUDIENCE') return 'async-furious-project';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    strategy = new JwtStrategy(config, authService);
  });

  it('should return AuthenticatedUser from DB when token is valid', async () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'test@test.com',
      role: Role.ADMIN,
    };
    authService.validateUser.mockResolvedValue(mockUser);

    const payload = {
      sub: 'user-1',
      email: 'test@test.com',
      role: Role.ADMIN,
      iss: 'repo-auth-serverless',
      aud: 'async-furious-project',
      exp: 9999999999,
    };
    const result = await strategy.validate(payload);

    expect(result).toEqual(mockUser);
    expect(authService.validateUser).toHaveBeenCalledWith('user-1');
  });

  it('should throw UnauthorizedException when user not found in DB', async () => {
    authService.validateUser.mockResolvedValue(null);

    const payload = {
      sub: 'user-1',
      email: 'test@test.com',
      role: Role.ADMIN,
      iss: 'repo-auth-serverless',
      aud: 'async-furious-project',
      exp: 9999999999,
    };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('should use role from DB, not from token payload', async () => {
    const dbUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'test@test.com',
      role: Role.RECEPCIONISTA,
    };
    authService.validateUser.mockResolvedValue(dbUser);

    const payload = {
      sub: 'user-1',
      email: 'test@test.com',
      role: Role.ADMIN,
      iss: 'repo-auth-serverless',
      aud: 'async-furious-project',
      exp: 9999999999,
    };
    const result = await strategy.validate(payload);

    expect(result.role).toBe(Role.RECEPCIONISTA);
    expect(result.role).not.toBe(payload.role);
  });

  it('configures RS256 verification with the shared contract', () => {
    const rsConfig = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_ALGORITHM') return 'RS256';
        if (key === 'JWT_PUBLIC_KEY') return 'public-key';
        if (key === 'JWT_ISSUER') return 'repo-auth-serverless';
        if (key === 'JWT_AUDIENCE') return 'async-furious-project';
        return undefined;
      }),
    } as unknown as ConfigService;

    expect(() => new JwtStrategy(rsConfig, authService)).not.toThrow();
  });

  it('rejects production without explicit RS256 configuration', () => {
    const productionConfig = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'production' : undefined)),
    } as unknown as ConfigService;

    expect(() => new JwtStrategy(productionConfig, authService)).toThrow();
  });
});
