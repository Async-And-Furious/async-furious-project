import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface PublicRouteGuard {
  canActivate(context: ExecutionContext): unknown;
}

export function describePublicRouteGuard<TGuard extends PublicRouteGuard>(
  GuardCtor: new (reflector: Reflector) => TGuard
): void {
  let guard: TGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new GuardCtor(reflector);
  });

  const setPublic = (isPublic: boolean) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      return undefined;
    });
  };

  it('should return true when route is marked @Public()', () => {
    setPublic(true);
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({}),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should NOT call super.canActivate when route is @Public()', () => {
    setPublic(true);
    const superCanActivateSpy = jest.spyOn(GuardCtor.prototype, 'canActivate');
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({}),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    void guard.canActivate(mockContext);
    expect(superCanActivateSpy).toHaveBeenCalledTimes(1);
  });
}
