import { Logger } from '@nestjs/common';
import type { IPublicadorIntegracao } from '../../../../shared/domain/interfaces/publicador-integracao.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { EtapaDaSagaFalhou } from '../../domain/events/etapa-da-saga-falhou.event';

export const PRAZO_PADRAO_MINUTOS = 48 * 60;

export interface ResultadoDetector {
  encontradas: number;
  encerradas: number;
  falhas: number;
}

/**
 * Detector de OS parada (ADR-0018, "Garantias de publicação"; `saga-flow.md` §3): substitui o
 * timeout de um orquestrador. Varre só OS em AWAITING_APPROVAL com `pago_em` nulo e sem
 * atualização além do prazo (cliente que não aprovou ou não pagou) e, para cada uma:
 *
 * 1. publica `EtapaDaSagaFalhou` (`etapa=aprovacao-pagamento`, `eventTypeOriginal = null`), para
 *    o Billing cancelar a cobrança e o Execução cancelar a `Execucao`;
 * 2. aplica a compensação local no mesmo ato: fecha a OS como CLOSED_WITHOUT_EXECUTION,
 *    condicionado a AWAITING_APPROVAL e `pago_em` nulo, e registra o motivo.
 *
 * Publica antes de fechar: se o fechamento falhar, a próxima execução publica de novo, e as
 * compensações são idempotentes. Fechada, a OS sai da varredura. Se o pagamento chegar entre a
 * busca e o fechamento, a condição não casa e a OS segue (o Billing estorna o pagamento atrasado).
 * A devolução ao estoque das peças reservadas é compensação da #338.
 */
export class DetectarOsParadaUseCase {
  private readonly logger = new Logger(DetectarOsParadaUseCase.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly publicador: IPublicadorIntegracao,
    private readonly prazoMinutos: number = PRAZO_PADRAO_MINUTOS,
    private readonly agora: () => Date = () => new Date()
  ) {}

  async executar(): Promise<ResultadoDetector> {
    const limite = new Date(this.agora().getTime() - this.prazoMinutos * 60_000);
    const paradas = await this.ordemServicoRepository.findParadasAguardandoAprovacao(limite);
    const resultado: ResultadoDetector = { encontradas: paradas.length, encerradas: 0, falhas: 0 };
    const motivo = `OS em AWAITING_APPROVAL sem pagamento há mais de ${this.prazoMinutos} min (detector de OS parada)`;

    for (const os of paradas) {
      try {
        await this.publicador.publicar(
          new EtapaDaSagaFalhou('os-service', null, os.id, 'aprovacao-pagamento', motivo)
        );
        const encerrou = await this.ordemServicoRepository.atualizarSeCondicao(
          os.id,
          { status: 'AWAITING_APPROVAL', pago_em: null },
          { status: 'CLOSED_WITHOUT_EXECUTION' }
        );
        if (!encerrou) {
          this.logger.warn(`OS ${os.id} mudou entre a busca e o fechamento: segue como está`);
          continue;
        }
        await this.statusHistoryRepository.create(
          HistoricoStatus.create({
            ordemServicoId: os.id,
            statusAnterior: 'AWAITING_APPROVAL',
            statusNovo: 'CLOSED_WITHOUT_EXECUTION',
            motivo,
          })
        );
        resultado.encerradas += 1;
      } catch (erro) {
        resultado.falhas += 1;
        this.logger.error(
          `Falha ao tratar a OS parada ${os.id}: ${erro instanceof Error ? erro.message : String(erro)}`
        );
      }
    }

    this.logger.log(
      `Detector de OS parada: ${resultado.encontradas} encontradas, ${resultado.encerradas} encerradas, ${resultado.falhas} falhas (prazo ${this.prazoMinutos} min)`
    );
    return resultado;
  }
}
