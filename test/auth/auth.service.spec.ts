import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/services/auth.service';
import { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';
import { Role } from '../../src/auth/enums/role.enum';

jest.mock('bcrypt');

describe('AuthService', () => {
  const storedUser = {
    id: 'user-1',
    email: 'recepcao@example.com',
    name: 'Recepção',
    password: 'hashed-password',
    role: 'RECEPCIONISTA',
  };

  let prisma: {
    user: { findUnique: jest.Mock };
    cliente: { findFirst: jest.Mock; findUnique: jest.Mock };
  };
  let jwtService: { sign: jest.Mock };

  function buildService(env: Record<string, string>): AuthService {
    const config = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
    return new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      config
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: { findUnique: jest.fn() },
      cliente: { findFirst: jest.fn(), findUnique: jest.fn() },
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('login', () => {
    const loginDto = { email: 'Recepcao@Example.com ', password: 'secret123' };

    it('issues a token in production when the private key is configured', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const service = buildService({ NODE_ENV: 'production', JWT_PRIVATE_KEY: 'pem' });

      const result = await service.login(loginDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'recepcao@example.com' },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'recepcao@example.com',
        role: 'RECEPCIONISTA',
      });
      expect(result).toEqual({
        access_token: 'signed-token',
        user: { id: 'user-1', email: 'recepcao@example.com', role: 'RECEPCIONISTA' },
      });
    });

    it('refuses to sign tokens in production without the private key', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const service = buildService({ NODE_ENV: 'production' });

      await expect(service.login(loginDto)).rejects.toThrow(
        'Production JWT signing is disabled without JWT_PRIVATE_KEY'
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('signs tokens outside production without requiring the private key', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const service = buildService({ NODE_ENV: 'development' });

      await expect(service.login(loginDto)).resolves.toMatchObject({
        access_token: 'signed-token',
      });
    });
  });

  describe('validateUser', () => {
    it('returns null when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const service = buildService({});

      await expect(service.validateUser('missing')).resolves.toBeNull();
    });

    it('returns the user with the role typed as Role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        role: Role.ADMIN,
      });
      const service = buildService({});

      await expect(service.validateUser('user-1')).resolves.toEqual({
        id: 'user-1',
        email: 'admin@example.com',
        role: Role.ADMIN,
      });
    });
  });

  describe('validateCustomer', () => {
    it('returns null when there is no active customer with this id', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      const service = buildService({});

      await expect(service.validateCustomer('inactive-id')).resolves.toBeNull();
      expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inactive-id', ativo: true } })
      );
    });
  });

  describe('validateTokenSubject', () => {
    it('resolves staff users without looking up customers', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'mecanico@example.com',
        role: Role.MECANICO,
      });
      const service = buildService({});

      await expect(service.validateTokenSubject({ sub: 'user-1' })).resolves.toEqual({
        id: 'user-1',
        email: 'mecanico@example.com',
        role: Role.MECANICO,
      });
      expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to an active customer with the CLIENTE role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.cliente.findUnique.mockResolvedValue({
        id: 'cliente-1',
        email: 'cliente@example.com',
        ativo: true,
      });
      const service = buildService({});

      await expect(service.validateTokenSubject({ sub: 'cliente-1' })).resolves.toEqual({
        id: 'cliente-1',
        email: 'cliente@example.com',
        role: Role.CLIENTE,
      });
    });

    it('rejects a token whose subject is an inactive customer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.cliente.findUnique.mockResolvedValue({
        id: 'cliente-2',
        email: 'antigo@example.com',
        ativo: false,
      });
      const service = buildService({});

      await expect(service.validateTokenSubject({ sub: 'cliente-2' })).resolves.toBeNull();
    });
  });
});
