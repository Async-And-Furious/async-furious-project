import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;
  });

  const setMetadata = (roles: Role[] | undefined) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === ROLES_KEY) return roles;
      return undefined;
    });
  };

  it('should return true when no @Roles() metadata is set', () => {
    setMetadata(undefined);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should return true when user role matches required role', () => {
    setMetadata([Role.ADMIN]);
    const request = { user: { id: '1', email: 'admin@test.com', role: Role.ADMIN } };
    mockContext.switchToHttp().getRequest.mockReturnValue(request);

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should throw ForbiddenException when user role does not match', () => {
    setMetadata([Role.ADMIN]);
    const request = { user: { id: '1', email: 'user@test.com', role: Role.RECEPCIONISTA } };
    mockContext.switchToHttp().getRequest.mockReturnValue(request);

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is absent from request', () => {
    setMetadata([Role.ADMIN]);
    mockContext.switchToHttp().getRequest.mockReturnValue({});

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when requiredRoles is empty array', () => {
    setMetadata([]);
    const request = { user: { id: '1', email: 'admin@test.com', role: Role.ADMIN } };
    mockContext.switchToHttp().getRequest.mockReturnValue(request);

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should throw ForbiddenException when user role is undefined', () => {
    setMetadata([Role.ADMIN]);
    const request = { user: { id: '1', email: 'admin@test.com' } };
    mockContext.switchToHttp().getRequest.mockReturnValue(request);

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should handle multiple required roles and match one of them', () => {
    setMetadata([Role.ADMIN, Role.MECANICO]);
    const request = { user: { id: '1', email: 'mecanico@test.com', role: Role.MECANICO } };
    mockContext.switchToHttp().getRequest.mockReturnValue(request);

    expect(guard.canActivate(mockContext)).toBe(true);
  });
});
