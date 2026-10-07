import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from '../../src/modules/health/application/services/health.service';

describe('HealthService', () => {
  it('reports liveness and readiness when the database responds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const service = new HealthService(prisma as never);

    expect(service.live().status).toBe('ok');
    await expect(service.ready()).resolves.toMatchObject({ status: 'ok' });
  });

  it('uses the package version when it is available', () => {
    const prisma = { $queryRaw: jest.fn() };
    const service = new HealthService(prisma as never);
    const originalVersion = process.env.npm_package_version;
    process.env.npm_package_version = '2.0.0';

    expect(service.check().version).toBe('2.0.0');

    process.env.npm_package_version = originalVersion;
  });

  it('reports unavailable when the database check fails', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('offline')) };
    const service = new HealthService(prisma as never);

    await expect(service.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
