import { Module } from '@nestjs/common';
import { PagamentoController } from './presentation/controllers/pagamento.controller';
import { PagamentoRepository } from './infrastructure/repositories/pagamento.repository';
import { RegistrarPagamentoPolicy } from './application/policies/registrar-pagamento.policy';
import { AcionarEntregaOrdemServicoPolicy } from './application/policies/acionar-entrega-ordem-servico.policy';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';

@Module({
  controllers: [PagamentoController],
  providers: [
    PagamentoRepository,
    EmissorEventos,
    RegistrarPagamentoPolicy,
    AcionarEntregaOrdemServicoPolicy,
  ],
})
export class FinanceiroModule {}
