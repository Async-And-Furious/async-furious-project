import { Module } from '@nestjs/common';
import { MercadoPagoWebhookController } from './presentation/controllers/mercado-pago-webhook.controller';
import { PagamentoRepository } from './infrastructure/repositories/pagamento.repository';
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
import { ProcessarNotificacaoPagamentoUseCase } from './application/use-cases/processar-notificacao-pagamento.use-case';
import { MercadoPagoAssinaturaGuard } from './infrastructure/webhooks/mercado-pago-assinatura.guard';
import { MercadoPagoGateway } from './infrastructure/gateways/mercado-pago.gateway';
import { CobrancaPagamentoAdapter } from './infrastructure/adapters/cobranca-pagamento.adapter';
import { COBRANCA_PAGAMENTO_PORT } from '../../shared/domain/interfaces/cobranca-pagamento.port';

@Module({
  controllers: [MercadoPagoWebhookController],
  providers: [
    PagamentoRepository,
    { provide: EMISSOR_EVENTOS, useClass: EmissorEventos },
    {
      provide: PAGAMENTO_REPOSITORY,
      useExisting: PagamentoRepository,
    },
    { provide: GATEWAY_PAGAMENTO, useClass: MercadoPagoGateway },
    {
      provide: CriarCobrancaUseCase,
      useFactory: (repository: IPagamentoRepository, gateway: IGatewayPagamento) =>
        new CriarCobrancaUseCase(repository, gateway),
      inject: [PAGAMENTO_REPOSITORY, GATEWAY_PAGAMENTO],
    },
    {
      provide: ProcessarNotificacaoPagamentoUseCase,
      useFactory: (
        repository: IPagamentoRepository,
        gateway: IGatewayPagamento,
        emissor: IEmissorEventos
      ) => new ProcessarNotificacaoPagamentoUseCase(repository, gateway, emissor),
      inject: [PAGAMENTO_REPOSITORY, GATEWAY_PAGAMENTO, EMISSOR_EVENTOS],
    },
    MercadoPagoAssinaturaGuard,

    // ACL Adapter for ordem-servico
    {
      provide: COBRANCA_PAGAMENTO_PORT,
      useClass: CobrancaPagamentoAdapter,
    },
  ],
  exports: [COBRANCA_PAGAMENTO_PORT],
})
export class FinanceiroModule {}
