import { Module } from '@nestjs/common';
import { PagamentoController } from './presentation/controllers/pagamento.controller';
import { PagamentoRepository } from './infrastructure/repositories/pagamento.repository';
import { RegistrarPagamentoPolicy } from './application/policies/registrar-pagamento.policy';
import { AcionarEntregaOrdemServicoPolicy } from './application/policies/acionar-entrega-ordem-servico.policy';
import { AcionarEntregaOrdemServicoListener } from './infrastructure/listeners/acionar-entrega-ordem-servico.listener';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { PAGAMENTO_REPOSITORY } from './domain/interfaces/pagamento.interface';

@Module({
  controllers: [PagamentoController],
  providers: [
    PagamentoRepository,
    EmissorEventos,
    {
      provide: PAGAMENTO_REPOSITORY,
      useExisting: PagamentoRepository,
    },
    RegistrarPagamentoPolicy,
    AcionarEntregaOrdemServicoPolicy,
    AcionarEntregaOrdemServicoListener,
  ],
})
export class FinanceiroModule {}
