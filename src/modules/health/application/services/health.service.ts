import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthResponseDto } from '../dto/health-response.dto';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  live(): HealthResponseDto {
    return this.check();
  }

  async ready(): Promise<HealthResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.check();
    } catch {
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}
