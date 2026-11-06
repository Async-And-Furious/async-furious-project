import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { MensageriaModule } from '../../shared/infrastructure/mensageria/mensageria.module';
import {
  PUBLICADOR_INTEGRACAO,
  type IPublicadorIntegracao,
} from '../../shared/domain/interfaces/publicador-integracao.interface';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { StatusHistoryRepository } from './infrastructure/repositories/status-history.repository';
import { OS_STATUS_TRANSITION_LOGGER } from './application/logging/log-os-status-transition';
import { OsStatusTransitionPinoLogger } from './infrastructure/logging/os-status-transition-pino-logger';
import {
  DetectarOsParadaUseCase,
  PRAZO_PADRAO_MINUTOS,
} from './application/use-cases/detectar-os-parada.use-case';

export function prazoDetectorMinutos(env: NodeJS.ProcessEnv = process.env): number {
  const bruto = env.DETECTOR_OS_PARADA_PRAZO_MINUTOS;
  if (bruto === undefined || bruto.trim() === '') return PRAZO_PADRAO_MINUTOS;
  const minutos = Number(bruto);
  if (!Number.isInteger(minutos) || minutos <= 0) {
    throw new Error(`DETECTOR_OS_PARADA_PRAZO_MINUTOS inválido: ${bruto}`);
  }
  return minutos;
}

/**
 * Contexto mínimo do CronJob do detector: banco, publicador Kafka e o caso de uso. Sem HTTP,
 * sem consumidor e sem os handlers in-process da API.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, MensageriaModule],
  providers: [
    {
      provide: OS_STATUS_TRANSITION_LOGGER,
      useFactory: () => new OsStatusTransitionPinoLogger(),
    },
    OrdemServicoRepository,
    StatusHistoryRepository,
    {
      provide: DetectarOsParadaUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        historicoRepo: StatusHistoryRepository,
        publicador: IPublicadorIntegracao,
        transitionLogger: OsStatusTransitionPinoLogger
      ) =>
        new DetectarOsParadaUseCase(
          osRepo,
          historicoRepo,
          publicador,
          transitionLogger,
          prazoDetectorMinutos(),
          () => new Date()
        ),
      inject: [
        OrdemServicoRepository,
        StatusHistoryRepository,
        PUBLICADOR_INTEGRACAO,
        OS_STATUS_TRANSITION_LOGGER,
      ],
    },
  ],
})
export class DetectorOsParadaModule {}
