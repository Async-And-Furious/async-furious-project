import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn() }));

const DATABASE_ENV_KEYS = [
  'DATABASE_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_SSLMODE',
] as const;

describe('PrismaService', () => {
  const originalEnv: Partial<Record<(typeof DATABASE_ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of DATABASE_ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    jest.mocked(PrismaClient).mockClear();
  });

  afterEach(() => {
    for (const key of DATABASE_ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('uses DATABASE_URL as-is when it is provided', () => {
    process.env.DATABASE_URL = 'postgresql://app:secret@db.internal:5432/os_service';

    new PrismaService();

    expect(PrismaClient).toHaveBeenCalledWith({
      datasources: { db: { url: 'postgresql://app:secret@db.internal:5432/os_service' } },
    });
  });

  it('builds the URL from the explicit contract using port 5432 and sslmode require by default', () => {
    process.env.DB_HOST = 'db.internal';
    process.env.DB_NAME = 'os_service';
    process.env.DB_USER = 'svc';
    process.env.DB_PASSWORD = 'p@ss/word';

    new PrismaService();

    expect(PrismaClient).toHaveBeenCalledWith({
      datasources: {
        db: { url: 'postgresql://svc:p%40ss%2Fword@db.internal:5432/os_service?sslmode=require' },
      },
    });
  });

  it('honours DB_PORT and DB_SSLMODE when they are provided', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '6543';
    process.env.DB_NAME = 'os_service';
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    process.env.DB_SSLMODE = 'disable';

    new PrismaService();

    expect(PrismaClient).toHaveBeenCalledWith({
      datasources: {
        db: { url: 'postgresql://postgres:postgres@localhost:6543/os_service?sslmode=disable' },
      },
    });
  });

  it('rejects an incomplete database contract', () => {
    process.env.DB_HOST = 'localhost';

    expect(() => new PrismaService()).toThrow(
      'DATABASE_URL or the explicit DB_HOST/DB_NAME/DB_USER/DB_PASSWORD contract is required'
    );
    expect(PrismaClient).not.toHaveBeenCalled();
  });
});
