import { Injectable } from '@nestjs/common';
import { HealthResponseDto } from '../dto/health-response.dto';

@Injectable()
export class HealthService {
  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }
}
