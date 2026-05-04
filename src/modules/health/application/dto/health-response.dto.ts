import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Health status',
    example: 'ok',
  })
  status: 'ok' | 'degraded' | 'down';

  @ApiProperty({
    description: 'Current server timestamp in ISO format',
    example: '2025-01-01T00:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'API version',
    example: '1.0.0',
  })
  version: string;
}
