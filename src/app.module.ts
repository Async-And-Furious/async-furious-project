import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { AuthModule } from './auth/auth.module';
import { CadastroModule } from './modules/cadastro/cadastro.module';
import { PecasInsumosModule } from './modules/pecas-insumos/pecas-insumos.module';
import { OrdemServicoModule } from './modules/ordem-servico/ordem-servico.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { GlobalExceptionFilter } from './shared/infrastructure/filters/global-exception.filter';
import { pinoHttpOptions } from './shared/infrastructure/logging/pino-logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'short', ttl: 60000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    CadastroModule,
    PecasInsumosModule,
    OrdemServicoModule,
    FinanceiroModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
