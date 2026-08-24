import { ConfigService } from '@nestjs/config';
import { JwtCustomerStrategy } from './jwt-customer.strategy';
import { Role } from '../enums/role.enum';

describe('JwtCustomerStrategy', () => {
  const buildConfig = (value: string | undefined): jest.Mocked<ConfigService> =>
    ({
      get: jest.fn().mockReturnValue(value),
    }) as unknown as jest.Mocked<ConfigService>;

  it('should throw when JWT_CUSTOMER_PUBLIC_KEY is not configured', () => {
    expect(() => new JwtCustomerStrategy(buildConfig(undefined))).toThrow(
      'JWT_CUSTOMER_PUBLIC_KEY environment variable is required'
    );
  });

  it('should map the externally-issued payload to an AuthenticatedUser with role CLIENTE', () => {
    const strategy = new JwtCustomerStrategy(buildConfig('test-public-key'));

    const result = strategy.validate({ sub: 'cliente-1' });

    expect(result).toEqual({ id: 'cliente-1', role: Role.CLIENTE });
  });
});
