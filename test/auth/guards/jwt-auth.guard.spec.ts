import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let mockContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;

    guard = new JwtAuthGuard(reflector);
  });

  describe('canActivate', () => {
    it('deve permitir acesso para rotas públicas', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('deve chamar super.canActivate para rotas protegidas', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(false);
      const superCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate'
      );
      superCanActivateSpy.mockReturnValue(true);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);

      // Cleanup
      superCanActivateSpy.mockRestore();
    });

    it('deve chamar super.canActivate quando isPublic é undefined', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const superCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate'
      );
      superCanActivateSpy.mockReturnValue(true);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);

      // Cleanup
      superCanActivateSpy.mockRestore();
    });

    it('deve chamar super.canActivate quando isPublic é null', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(null);
      const superCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate'
      );
      superCanActivateSpy.mockReturnValue(true);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);

      // Cleanup
      superCanActivateSpy.mockRestore();
    });
  });

  describe('handleRequest', () => {
    it('deve retornar o usuário quando não há erro e usuário existe', () => {
      // Arrange
      const mockUser = { id: 1, email: 'test@example.com' };

      // Act
      const result = guard.handleRequest(null, mockUser);

      // Assert
      expect(result).toBe(mockUser);
    });

    it('deve lançar UnauthorizedException quando há erro', () => {
      // Arrange
      const mockError = new Error('JWT malformed');
      const mockUser = { id: 1, email: 'test@example.com' };

      // Act & Assert
      expect(() => guard.handleRequest(mockError, mockUser)).toThrow(mockError);
    });

    it('deve lançar UnauthorizedException quando não há usuário', () => {
      // Arrange & Act & Assert
      expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, null)).toThrow('Authentication required');
    });

    it('deve lançar UnauthorizedException quando usuário é undefined', () => {
      // Arrange & Act & Assert
      expect(() => guard.handleRequest(null, undefined)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, undefined)).toThrow('Authentication required');
    });

    it('deve lançar erro original quando há erro e usuário', () => {
      // Arrange
      const mockError = new UnauthorizedException('Token expired');
      const mockUser = { id: 1, email: 'test@example.com' };

      // Act & Assert
      expect(() => guard.handleRequest(mockError, mockUser)).toThrow(mockError);
    });

    it('deve lançar erro original quando há erro e não há usuário', () => {
      // Arrange
      const mockError = new UnauthorizedException('Invalid token');

      // Act & Assert
      expect(() => guard.handleRequest(mockError, null)).toThrow(mockError);
    });

    it('deve funcionar com diferentes tipos de usuário', () => {
      // Arrange
      const mockUserString = 'user-id-123';
      const mockUserNumber = 42;
      const mockUserObject = { userId: 'abc', role: 'admin' };

      // Act & Assert
      expect(guard.handleRequest(null, mockUserString)).toBe(mockUserString);
      expect(guard.handleRequest(null, mockUserNumber)).toBe(mockUserNumber);
      expect(guard.handleRequest(null, mockUserObject)).toBe(mockUserObject);
    });

    it('deve lançar UnauthorizedException para valores falsy do usuário', () => {
      // Arrange & Act & Assert
      expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, 0)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, '')).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, NaN)).toThrow(UnauthorizedException);
    });
  });

  describe('constructor', () => {
    it('deve criar instância com reflector', () => {
      // Arrange & Act
      const newGuard = new JwtAuthGuard(reflector);

      // Assert
      expect(newGuard).toBeInstanceOf(JwtAuthGuard);
      expect(newGuard['reflector']).toBe(reflector);
    });
  });

  describe('integração com decorators', () => {
    it('deve verificar metadata corretamente para handler e class', () => {
      // Arrange
      const mockHandler = jest.fn();
      const mockClass = jest.fn();
      mockContext.getHandler.mockReturnValue(mockHandler);
      mockContext.getClass.mockReturnValue(mockClass);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act
      guard.canActivate(mockContext);

      // Assert
      expect(mockContext.getHandler).toHaveBeenCalled();
      expect(mockContext.getClass).toHaveBeenCalled();
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockHandler,
        mockClass,
      ]);
    });
  });
});
