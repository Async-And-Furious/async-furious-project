import { UnauthorizedException } from '@nestjs/common';
import { JwtCustomerAuthGuard } from './jwt-customer-auth.guard';

describe('JwtCustomerAuthGuard', () => {
  let guard: JwtCustomerAuthGuard;

  beforeEach(() => {
    guard = new JwtCustomerAuthGuard();
  });

  describe('handleRequest', () => {
    it('should return the user when authentication succeeds', () => {
      const user = { id: 'cliente-id' };
      expect(guard.handleRequest(null, user)).toBe(user);
    });

    it('should throw the original error when authentication fails with an error', () => {
      const error = new Error('token inválido');
      expect(() => guard.handleRequest(error, null)).toThrow(error);
    });

    it('should throw UnauthorizedException when there is no error but no user either', () => {
      expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
    });
  });
});
