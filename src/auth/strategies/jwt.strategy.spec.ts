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
      validateCustomer: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    config = {
      get: jest.fn().mockReturnValue('test-secret'),
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

    const payload = { sub: 'user-1', email: 'test@test.com' };
    const result = await strategy.validate(payload);

    expect(result).toEqual(mockUser);
    expect(authService.validateUser).toHaveBeenCalledWith('user-1');
  });

  it('should throw UnauthorizedException when user not found in DB', async () => {
    authService.validateUser.mockResolvedValue(null);

    const payload = { sub: 'user-1', email: 'test@test.com' };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('should use role from DB, not from token payload', async () => {
    const dbUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'test@test.com',
      role: Role.RECEPCIONISTA,
    };
    authService.validateUser.mockResolvedValue(dbUser);

    const payload = { sub: 'user-1', email: 'test@test.com' };
    const result = await strategy.validate(payload);

    expect(result.role).toBe(Role.RECEPCIONISTA);
    expect(result.role).not.toBe(payload.role);
  });

  it('should resolve gateway subject as Cliente.id', async () => {
    const gatewayValues: Record<string, string> = {
      AUTH_MODE: 'gateway',
      JWT_PUBLIC_KEY: 'public-key',
      JWT_ISSUER: 'auth-lambda',
      JWT_AUDIENCE: 'workshop-api',
    };
    config.get.mockImplementation((key: string) => gatewayValues[key]);
    strategy = new JwtStrategy(config, authService);
    const customer: AuthenticatedUser = {
      id: 'customer-id',
      email: 'customer@test.com',
      role: Role.RECEPCIONISTA,
    };
    authService.validateCustomer.mockResolvedValue(customer);

    await expect(strategy.validate({ sub: 'customer-id' })).resolves.toEqual(customer);
    expect(authService.validateCustomer).toHaveBeenCalledWith('customer-id');
  });

  it('should reject a gateway token whose customer does not exist', async () => {
    const gatewayValues: Record<string, string> = {
      AUTH_MODE: 'gateway',
      JWT_PUBLIC_KEY: 'public-key',
      JWT_ISSUER: 'auth-lambda',
      JWT_AUDIENCE: 'workshop-api',
    };
    config.get.mockImplementation((key: string) => gatewayValues[key]);
    strategy = new JwtStrategy(config, authService);
    authService.validateCustomer.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'missing-customer' })).rejects.toThrow(
      UnauthorizedException
    );
  });
});
