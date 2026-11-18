import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from '../../src/modules/health/application/services/health.service';
import { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';

describe('HealthService', () => {
  const originalVersion = process.env.npm_package_version;

  afterEach(() => {
    if (originalVersion === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = originalVersion;
  });

  function buildService(queryRaw: jest.Mock): HealthService {
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    return new HealthService(prisma);
  }

  it('reports the package version when npm provides it', () => {
    process.env.npm_package_version = '2.0.0';

    expect(buildService(jest.fn()).check()).toMatchObject({ status: 'ok', version: '2.0.0' });
  });

  it('falls back to 1.0.0 when no package version is available', () => {
    delete process.env.npm_package_version;

    expect(buildService(jest.fn()).check()).toMatchObject({ status: 'ok', version: '1.0.0' });
  });

  it('reports liveness without touching the database', () => {
    const queryRaw = jest.fn();

    expect(buildService(queryRaw).live()).toMatchObject({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness when the database answers', async () => {
    const service = buildService(jest.fn().mockResolvedValue([{ '?column?': 1 }]));

    await expect(service.ready()).resolves.toMatchObject({ status: 'ok' });
  });

  it('reports unavailable when the database check fails', async () => {
    const service = buildService(jest.fn().mockRejectedValue(new Error('connection refused')));

    await expect(service.ready()).rejects.toThrow(ServiceUnavailableException);
    await expect(service.ready()).rejects.toThrow('Database is not ready');
  });
});
