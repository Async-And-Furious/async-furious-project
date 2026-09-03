import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../../../auth/decorators/public.decorator';
import { HealthService } from '../../application/services/health.service';
import { HealthResponseDto } from '../../application/dto/health-response.dto';

@Controller('health')
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
  @Get('live')
  live(): HealthResponseDto {
    return this.healthService.live();
  }

  @Public()
  @Get('ready')
  ready(): Promise<HealthResponseDto> {
    return this.healthService.ready();
  }
}
