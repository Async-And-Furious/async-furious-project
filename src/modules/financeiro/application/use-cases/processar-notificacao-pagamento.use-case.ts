import type { Pagamento } from '../../domain/entities/pagamento.entity';
import { PagamentoConfirmadoEvent } from '../../domain/events/pagamento-confirmado.event';
import { PagamentoRecusadoEvent } from '../../domain/events/pagamento-recusado.event';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
  PagamentoExterno,
} from '../../domain/interfaces/pagamento.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';

export type ResultadoNotificacao =
  | 'CONFIRMADO'
  | 'RECUSADO'
  | 'JA_PROCESSADO'
  | 'PAGAMENTO_NAO_ENCONTRADO'
  | 'COBRANCA_NAO_ENCONTRADA'
  | 'VALOR_DIVERGENTE'
  | 'APROVADO_APOS_ENCERRAMENTO'
  | 'STATUS_IGNORADO';

const STATUS_RECUSA = ['rejected', 'cancelled'];

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
      ? await this.repository.findByOrdemServicoId(externo.referenciaExterna)
      : null;
    if (!pagamento) {
      return 'COBRANCA_NAO_ENCONTRADA';
    }

    if (externo.status === 'approved') {
      return this.confirmar(pagamento, externo);
    }
    if (STATUS_RECUSA.includes(externo.status)) {
      return this.recusar(pagamento, externo);
    }
    // pending, in_process, authorized etc.: sem efeito e sem evento.
    return 'STATUS_IGNORADO';
  }

  private async confirmar(
    pagamento: Pagamento,
    externo: PagamentoExterno
  ): Promise<ResultadoNotificacao> {
    const externoGravado = pagamento.getPagamentoExternoId();
    // Sem id gravado = confirmado antes de o id do Mercado Pago ser guardado; trata como reentrega.
    if (
      pagamento.getStatus() === 'CONFIRMADO' &&
      (externoGravado === externo.id || externoGravado === null)
    ) {
      return 'JA_PROCESSADO';
    }
    if (!pagamento.estaPendente()) {
      // Aprovado depois de a cobrança ter sido encerrada (ex.: recusa anterior): exige estorno (em aberto na ADR-0022).
      return 'APROVADO_APOS_ENCERRAMENTO';
    }
    if (externo.valor === null || Math.abs(externo.valor - pagamento.getValor()) >= 0.01) {
      return 'VALOR_DIVERGENTE';
    }

    pagamento.confirmar(externo.id);
    if (!(await this.repository.saveComNotificacao(pagamento, notificacao(externo)))) {
      return 'JA_PROCESSADO';
    }
    await this.emissor.emitir(
      new PagamentoConfirmadoEvent(pagamento.getId(), pagamento.getOrdemServicoId())
    );
    return 'CONFIRMADO';
  }

  private async recusar(
    pagamento: Pagamento,
    externo: PagamentoExterno
  ): Promise<ResultadoNotificacao> {
    if (!pagamento.estaPendente()) {
      return pagamento.getPagamentoExternoId() === externo.id ? 'JA_PROCESSADO' : 'STATUS_IGNORADO';
    }

    pagamento.recusar(externo.id);
    if (!(await this.repository.saveComNotificacao(pagamento, notificacao(externo)))) {
      return 'JA_PROCESSADO';
    }
    await this.emissor.emitir(
      new PagamentoRecusadoEvent(pagamento.getId(), pagamento.getOrdemServicoId())
    );
    return 'RECUSADO';
  }
}

const notificacao = (externo: PagamentoExterno) => ({
  providerEventId: externo.id,
  tipo: `payment.${externo.status}`,
});
