import { Module } from '@nestjs/common';
import { PagamentoController } from './presentation/controllers/pagamento.controller';
import { PagamentoRepository } from './infrastructure/repositories/pagamento.repository';
import { RegistrarPagamentoUseCase } from './application/use-cases/registrar-pagamento.use-case';
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
    {
      provide: RegistrarPagamentoUseCase,
      useFactory: (repository: PagamentoRepository, emissor: EmissorEventos) =>
        new RegistrarPagamentoUseCase(repository, emissor),
      inject: [PAGAMENTO_REPOSITORY, EmissorEventos],
    },
    AcionarEntregaOrdemServicoPolicy,
    AcionarEntregaOrdemServicoListener,
  ],
})
export class FinanceiroModule {}
