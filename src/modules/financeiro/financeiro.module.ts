import { Module } from '@nestjs/common';
import { PagamentoController } from './presentation/controllers/pagamento.controller';
import { PagamentoRepository } from './infrastructure/repositories/pagamento.repository';
import { RegistrarPagamentoUseCase } from './application/use-cases/registrar-pagamento.use-case';
import { AcionarEntregaOrdemServicoHandler } from './application/event-handlers/acionar-entrega-ordem-servico.handler';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import {
  EMISSOR_EVENTOS,
  IEmissorEventos,
} from '../../shared/domain/interfaces/emissor-eventos.interface';
import { PAGAMENTO_REPOSITORY } from './domain/interfaces/pagamento.interface';
import { REFUND_GATEWAY } from './domain/interfaces/pagamento.interface';
import { RefundGatewayStub } from './infrastructure/gateways/refund.gateway.stub';

@Module({
  controllers: [PagamentoController],
  providers: [
    PagamentoRepository,
    { provide: REFUND_GATEWAY, useClass: RefundGatewayStub },
    { provide: EMISSOR_EVENTOS, useClass: EmissorEventos },
    {
      provide: PAGAMENTO_REPOSITORY,
      useExisting: PagamentoRepository,
    },
    {
      provide: RegistrarPagamentoUseCase,
      useFactory: (repository: PagamentoRepository, emissor: IEmissorEventos) =>
        new RegistrarPagamentoUseCase(repository, emissor),
      inject: [PAGAMENTO_REPOSITORY, EMISSOR_EVENTOS],
    },
    {
      provide: AcionarEntregaOrdemServicoHandler,
      useFactory: (emissor: IEmissorEventos) => new AcionarEntregaOrdemServicoHandler(emissor),
      inject: [EMISSOR_EVENTOS],
    },
  ],
  exports: [PagamentoRepository, PAGAMENTO_REPOSITORY, REFUND_GATEWAY],
})
export class FinanceiroModule {}
