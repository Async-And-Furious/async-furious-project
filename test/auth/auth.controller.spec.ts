import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/services/auth.service';
import { LoginDto, RegisterDto } from '../../src/auth/dto/auth.dto';
import { Role } from '../../src/auth/enums/role.enum';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockRolesGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockThrottlerGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .overrideGuard(ThrottlerGuard)
      .useValue(mockThrottlerGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: Role.RECEPCIONISTA,
    };

    const expectedResult = {
      access_token: 'jwt-token-here',
      user: {
        id: '1',
        email: 'test@example.com',
        role: Role.RECEPCIONISTA,
      },
    };

    it('should register a new user successfully', async () => {
      authService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should register user with default role when role is not provided', async () => {
      const registerDtoWithoutRole = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const expectedResultWithDefaultRole = {
        access_token: 'jwt-token-here',
        user: {
          id: '1',
          email: 'test@example.com',
          role: Role.RECEPCIONISTA,
        },
      };

      authService.register.mockResolvedValue(expectedResultWithDefaultRole);

      const result = await controller.register(registerDtoWithoutRole);

      expect(authService.register).toHaveBeenCalledWith(registerDtoWithoutRole);
      expect(result).toEqual(expectedResultWithDefaultRole);
    });

    it('should handle registration errors', async () => {
      const error = new Error('Email already exists');
      authService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow(error);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should register user with ADMIN role', async () => {
      const adminRegisterDto: RegisterDto = {
        ...registerDto,
        role: Role.ADMIN,
      };

      const expectedAdminResult = {
        access_token: 'jwt-token-here',
        user: {
          id: '1',
          email: 'test@example.com',
          role: Role.ADMIN,
        },
      };

      authService.register.mockResolvedValue(expectedAdminResult);

      const result = await controller.register(adminRegisterDto);

      expect(authService.register).toHaveBeenCalledWith(adminRegisterDto);
      expect(result).toEqual(expectedAdminResult);
    });

    it('should register user with MECANICO role', async () => {
      const mecanicoRegisterDto: RegisterDto = {
        ...registerDto,
        role: Role.MECANICO,
      };

      const expectedMecanicoResult = {
        access_token: 'jwt-token-here',
        user: {
          id: '1',
          email: 'test@example.com',
          role: Role.MECANICO,
        },
      };

      authService.register.mockResolvedValue(expectedMecanicoResult);

      const result = await controller.register(mecanicoRegisterDto);

      expect(authService.register).toHaveBeenCalledWith(mecanicoRegisterDto);
      expect(result).toEqual(expectedMecanicoResult);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const expectedResult = {
      access_token: 'jwt-token-here',
      user: {
        id: '1',
        email: 'test@example.com',
        role: Role.RECEPCIONISTA,
      },
    };

    it('should login user successfully', async () => {
      authService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle login with different email formats', async () => {
      const loginDtoUpperCase: LoginDto = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      };

      authService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDtoUpperCase);

      expect(authService.login).toHaveBeenCalledWith(loginDtoUpperCase);
      expect(result).toEqual(expectedResult);
    });

    it('should handle login errors', async () => {
      const error = new Error('Invalid credentials');
      authService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(error);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle login with minimum password length', async () => {
      const loginDtoMinPassword: LoginDto = {
        email: 'test@example.com',
        password: '12345678', // minimum 8 characters
      };

      authService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDtoMinPassword);

      expect(authService.login).toHaveBeenCalledWith(loginDtoMinPassword);
      expect(result).toEqual(expectedResult);
    });

    it('should handle login with maximum password length', async () => {
      const longPassword = 'a'.repeat(100); // maximum 100 characters
      const loginDtoMaxPassword: LoginDto = {
        email: 'test@example.com',
        password: longPassword,
      };

      authService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDtoMaxPassword);

      expect(authService.login).toHaveBeenCalledWith(loginDtoMaxPassword);
      expect(result).toEqual(expectedResult);
    });

    it('should return different token for different users', async () => {
      const differentUserResult = {
        access_token: 'different-jwt-token',
        user: {
          id: '2',
          email: 'admin@example.com',
          role: Role.ADMIN,
        },
      };

      const adminLoginDto: LoginDto = {
        email: 'admin@example.com',
        password: 'adminpass123',
      };

      authService.login.mockResolvedValue(differentUserResult);

      const result = await controller.login(adminLoginDto);

      expect(authService.login).toHaveBeenCalledWith(adminLoginDto);
      expect(result).toEqual(differentUserResult);
      expect(result.access_token).not.toEqual(expectedResult.access_token);
    });
  });

  describe('controller setup', () => {
    it('should have correct controller metadata', () => {
      const controllerMetadata = Reflect.getMetadata('path', AuthController);
      expect(controllerMetadata).toBe('auth');
    });

    it('should be properly instantiated with AuthService', () => {
      expect(controller).toBeInstanceOf(AuthController);
      expect(authService).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should propagate service errors in register', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const serviceError = new Error('Database connection failed');
      authService.register.mockRejectedValue(serviceError);

      await expect(controller.register(registerDto)).rejects.toThrow('Database connection failed');
    });

    it('should propagate service errors in login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const serviceError = new Error('Authentication service unavailable');
      authService.login.mockRejectedValue(serviceError);

      await expect(controller.login(loginDto)).rejects.toThrow(
        'Authentication service unavailable'
      );
    });
  });
});
