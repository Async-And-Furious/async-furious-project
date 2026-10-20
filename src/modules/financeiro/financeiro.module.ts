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
import { GATEWAY_PAGAMENTO, PAGAMENTO_REPOSITORY } from './domain/interfaces/pagamento.interface';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
} from './domain/interfaces/pagamento.interface';
import { CriarCobrancaUseCase } from './application/use-cases/criar-cobranca.use-case';
import { MercadoPagoGateway } from './infrastructure/gateways/mercado-pago.gateway';
import { CobrancaPagamentoAdapter } from './infrastructure/adapters/cobranca-pagamento.adapter';
import { COBRANCA_PAGAMENTO_PORT } from '../../shared/domain/interfaces/cobranca-pagamento.port';

@Module({
  controllers: [PagamentoController],
  providers: [
    PagamentoRepository,
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
    { provide: GATEWAY_PAGAMENTO, useClass: MercadoPagoGateway },
    {
      provide: CriarCobrancaUseCase,
      useFactory: (repository: IPagamentoRepository, gateway: IGatewayPagamento) =>
        new CriarCobrancaUseCase(repository, gateway),
      inject: [PAGAMENTO_REPOSITORY, GATEWAY_PAGAMENTO],
    },

    // ACL Adapter for ordem-servico
    {
      provide: COBRANCA_PAGAMENTO_PORT,
      useClass: CobrancaPagamentoAdapter,
    },
  ],
  exports: [COBRANCA_PAGAMENTO_PORT],
})
export class FinanceiroModule {}
