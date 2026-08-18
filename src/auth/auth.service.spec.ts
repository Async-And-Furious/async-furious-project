import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuthService } from './services/auth.service';
import { PrismaService } from '../shared/infrastructure/database/prisma.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    cliente: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockImplementation(() => Promise.resolve('hashed'));
    (bcrypt.compare as jest.Mock).mockImplementation(() => Promise.resolve(true));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        ConfigService,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'RECEPCIONISTA',
      });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('access_token');
      expect(result.user).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        role: 'RECEPCIONISTA',
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'RECEPCIONISTA',
      });

      await service.register({ ...registerDto, email: 'TEST@EXAMPLE.COM' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'ADMIN',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('access_token');
      expect(result.user).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        role: 'ADMIN',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockImplementationOnce(() => Promise.resolve(false));

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should normalize email to lowercase', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await service.login({ ...loginDto, email: 'TEST@EXAMPLE.COM' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('validateUser', () => {
    it('should return user without password', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser('user-id');

      expect(result).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        role: 'admin',
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: { id: true, email: true, role: true },
      });
    });

    it('should return null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('validateTokenSubject', () => {
    it('accepts an active customer identified by CPF claims', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.cliente.findUnique.mockResolvedValue({
        id: 'cliente-id',
        email: 'cliente@example.com',
        ativo: true,
      });

      await expect(
        service.validateTokenSubject({ sub: '12345678901', cpf: '12345678901' })
      ).resolves.toEqual({
        id: 'cliente-id',
        email: 'cliente@example.com',
        role: 'CLIENTE',
      });
      expect(mockPrisma.cliente.findUnique).toHaveBeenCalledWith({
        where: { documento: '12345678901' },
        select: { id: true, email: true, ativo: true },
      });
    });

    it('rejects an inactive customer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.cliente.findUnique.mockResolvedValue({
        id: 'cliente-id',
        email: 'cliente@example.com',
        ativo: false,
      });

      await expect(service.validateTokenSubject({ sub: '12345678901' })).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'admin',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findById('user-id');

      expect(result).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        role: 'admin',
      });
    });

    it('should return null when user not found by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('config with default values', () => {
    it('should use default salt rounds when config is undefined', async () => {
      const mockPrismaWithDefault = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'user-id',
            email: 'test@example.com',
            name: 'Test User',
            password: 'hashed-password',
            role: 'RECEPCIONISTA',
          }),
        },
      };

      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const testModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: mockPrismaWithDefault },
          { provide: JwtService, useValue: mockJwtService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = testModule.get<AuthService>(AuthService);

      await testService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });
  });
});
