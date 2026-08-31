import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../../auth/decorators/public.decorator';
import { HealthService } from '../../application/services/health.service';
import { HealthResponseDto } from '../../application/dto/health-response.dto';

@Controller()
@ApiTags('Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the API',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy',
    type: HealthResponseDto,
  })
  check(): HealthResponseDto {
    return this.healthService.check();
  }

  @Public()
  @Get('health/live')
  live(): HealthResponseDto {
    return this.healthService.check();
  }

  @Public()
  @Get('health/ready')
  async ready(@Res() response: Response): Promise<void> {
    const result = await this.healthService.ready();
    response
      .status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(result);
  }
}
