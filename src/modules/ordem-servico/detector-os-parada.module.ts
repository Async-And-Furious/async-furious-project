import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { MensageriaModule } from '../../shared/infrastructure/mensageria/mensageria.module';
import {
  PUBLICADOR_INTEGRACAO,
  type IPublicadorIntegracao,
} from '../../shared/domain/interfaces/publicador-integracao.interface';
import {
  RESERVA_ESTOQUE_PORT,
  type IReservaEstoquePort,
} from '../../shared/domain/interfaces/reserva-estoque.port';
import { ReservaEstoqueRepository } from '../pecas-insumos/infrastructure/repositories/reserva-estoque.repository';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { ReadModelModule } from '../../shared/infrastructure/read-model/read-model.module';
import { OsReadModelProjector } from './infrastructure/read-model/os-read-model.projector';
import { OS_READ_MODEL_PROJECTOR } from './domain/interfaces/os-read-model.interface';
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
 * Contexto mínimo do CronJob do detector: banco, read model, publicador Kafka, devolução de
 * peças e o caso de uso. Sem HTTP,
 * sem consumidor e sem os handlers in-process da API.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    MensageriaModule,
    ReadModelModule,
  ],
  providers: [
    {
      provide: OS_STATUS_TRANSITION_LOGGER,
      useFactory: () => new OsStatusTransitionPinoLogger(),
    },
    // O repository projeta no read model a OS encerrada pelo detector (ADR-0019).
    { provide: OS_READ_MODEL_PROJECTOR, useClass: OsReadModelProjector },
    OrdemServicoRepository,
    { provide: RESERVA_ESTOQUE_PORT, useClass: ReservaEstoqueRepository },
    {
      provide: DetectarOsParadaUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        publicador: IPublicadorIntegracao,
        transitionLogger: OsStatusTransitionPinoLogger,
        reservaEstoque: IReservaEstoquePort
      ) =>
        new DetectarOsParadaUseCase(
          osRepo,
          publicador,
          transitionLogger,
          reservaEstoque,
          prazoDetectorMinutos(),
          () => new Date()
        ),
      inject: [
        OrdemServicoRepository,
        PUBLICADOR_INTEGRACAO,
        OS_STATUS_TRANSITION_LOGGER,
        RESERVA_ESTOQUE_PORT,
      ],
    },
  ],
})
export class DetectorOsParadaModule {}
