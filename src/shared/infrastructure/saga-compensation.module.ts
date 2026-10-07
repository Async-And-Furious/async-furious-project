import { Module } from '@nestjs/common';
import { FinanceiroModule } from '../../modules/financeiro/financeiro.module';
import { OrdemServicoModule } from '../../modules/ordem-servico/ordem-servico.module';
import { PecasInsumosModule } from '../../modules/pecas-insumos/pecas-insumos.module';
import { PagamentoRepository } from '../../modules/financeiro/infrastructure/repositories/pagamento.repository';
import { ReservaEstoqueRepository } from '../../modules/pecas-insumos/infrastructure/repositories/reserva-estoque.repository';
import { OrdemServicoRepository } from '../../modules/ordem-servico/infrastructure/repositories/ordem-servico.repository';
import { EMISSOR_EVENTOS } from '../domain/interfaces/emissor-eventos.interface';
import type { IEmissorEventos } from '../domain/interfaces/emissor-eventos.interface';
import { SagaCompensationService } from '../application/saga-compensation.service';
import { SagaCompensationStore } from './database/saga-compensation.store';
import { SagaCompensationHandler } from './saga-compensation.handler';
import { EmissorEventos } from './emissor-eventos/emissor-eventos.service';
import { REFUND_GATEWAY } from '../../modules/financeiro/domain/interfaces/pagamento.interface';
import type { IRefundGateway } from '../../modules/financeiro/application/ports/refund.gateway';

@Module({
  imports: [FinanceiroModule, OrdemServicoModule, PecasInsumosModule],
  providers: [
    SagaCompensationStore,
    { provide: EMISSOR_EVENTOS, useClass: EmissorEventos },
    SagaCompensationHandler,
    {
      provide: SagaCompensationService,
      useFactory: (
        os: OrdemServicoRepository,
        reservas: ReservaEstoqueRepository,
        pagamentos: PagamentoRepository,
        refund: IRefundGateway,
        emissor: IEmissorEventos,
        store: SagaCompensationStore
      ) => new SagaCompensationService(os, reservas, pagamentos, refund, emissor, store),
      inject: [
        OrdemServicoRepository,
        ReservaEstoqueRepository,
        PagamentoRepository,
        REFUND_GATEWAY,
        EMISSOR_EVENTOS,
        SagaCompensationStore,
      ],
    },
  ],
})
export class SagaCompensationModule {}
