import { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';

describe('PrismaService configuration', () => {
  const keys = [
    'DATABASE_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'DB_SSLMODE',
  ];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('accepts the DATABASE_URL contract', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/workshop';
    expect(() => new PrismaService()).not.toThrow();
  });

  it('builds the URL from explicit database settings', () => {
    delete process.env.DATABASE_URL;
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'workshop';
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    expect(() => new PrismaService()).not.toThrow();
  });

  it('rejects an incomplete database contract', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    expect(() => new PrismaService()).toThrow('DATABASE_URL');
  });
});
