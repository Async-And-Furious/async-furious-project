import { Module } from '@nestjs/common';
import { HealthController } from './presentation/controllers/health.controller';
import { HealthService } from './application/services/health.service';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
  imports: [DatabaseModule],
})
export class HealthModule {}
