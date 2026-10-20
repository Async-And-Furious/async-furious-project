import { PagamentoConfirmadoEvent } from '../../domain/events/pagamento-confirmado.event';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
} from '../../domain/interfaces/pagamento.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';

export type ResultadoNotificacao =
  | 'CONFIRMADO'
  | 'JA_CONFIRMADO'
  | 'PAGAMENTO_NAO_ENCONTRADO'
  | 'COBRANCA_NAO_ENCONTRADA'
  | 'VALOR_DIVERGENTE'
  | 'STATUS_IGNORADO';

export class ProcessarNotificacaoPagamentoUseCase {
  constructor(
    private readonly repository: IPagamentoRepository,
    private readonly gateway: IGatewayPagamento,
    private readonly emissor: IEmissorEventos
  ) {}

  // A notificação só diz "algo mudou": o status vem sempre da reconsulta ao provedor.
  async execute(pagamentoExternoId: string): Promise<ResultadoNotificacao> {
    const externo = await this.gateway.consultarPagamento(pagamentoExternoId);
    if (!externo) {
      return 'PAGAMENTO_NAO_ENCONTRADO';
    }

    const pagamento = externo.referenciaExterna
      ? await this.repository.findCobrancaByOrdemServicoId(externo.referenciaExterna)
      : null;
    if (!pagamento) {
      return 'COBRANCA_NAO_ENCONTRADA';
    }

    // Recusado/pendente não encerra a cobrança: no Checkout Pro o cliente pode tentar de novo no mesmo link.
    if (externo.status !== 'approved') {
      return 'STATUS_IGNORADO';
    }

    if (pagamento.getStatus() === 'CONFIRMADO') {
      return 'JA_CONFIRMADO';
    }

    if (externo.valor === null || Math.abs(externo.valor - pagamento.getValor()) >= 0.01) {
      return 'VALOR_DIVERGENTE';
    }

    pagamento.confirmar();
    await this.repository.save(pagamento);
    await this.emissor.emitir(
      new PagamentoConfirmadoEvent(pagamento.getId(), pagamento.getOrdemServicoId())
    );
    return 'CONFIRMADO';
  }
}
