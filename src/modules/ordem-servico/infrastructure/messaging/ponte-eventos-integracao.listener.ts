import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  EventoIntegracao,
  IPublicadorIntegracao,
} from '../../../../shared/domain/interfaces/publicador-integracao.interface';
import { OrdemServicoRecebida } from '../../domain/events/ordem-servico-recebida.event';
import { OrcamentoCalculado } from '../../domain/events/orcamento-calculado.event';
import { EtapaDaSagaFalhou } from '../../domain/events/etapa-da-saga-falhou.event';

/**
 * Leva ao broker (`os.eventos.v1`) os três eventos que o OS Service produz para os outros
 * serviços (`event-catalog.md`). Os demais eventos de domínio continuam só in-process.
 *
 * Sem outbox (ADR-0018): a publicação acontece depois do commit e, se falhar, fica no log
 * e não desfaz a gravação. O detector de OS parada cobre a etapa de aprovação/pagamento;
 * nas demais, um evento perdido é recuperado por replay manual (risco aceito em HML).
 */
export class PonteEventosIntegracaoListener {
  private readonly logger = new Logger(PonteEventosIntegracaoListener.name);

  constructor(private readonly publicador: IPublicadorIntegracao) {}

  @OnEvent('OrdemServicoRecebida')
  async onOrdemServicoRecebida(evento: OrdemServicoRecebida): Promise<void> {
    await this.publicar(evento);
  }

  @OnEvent('OrcamentoCalculado')
  async onOrcamentoCalculado(evento: OrcamentoCalculado): Promise<void> {
    await this.publicar(evento);
  }

  // Só a falha detectada aqui sai pelo tópico do OS. Uma EtapaDaSagaFalhou de outro serviço,
  // recebida pelo consumidor e reemitida in-process, não volta ao broker (evita laço).
  @OnEvent('EtapaDaSagaFalhou')
  async onEtapaDaSagaFalhou(evento: EtapaDaSagaFalhou): Promise<void> {
    if (evento.servicoOrigem !== 'os-service') return;
    await this.publicar(evento);
  }

  private async publicar(evento: EventoIntegracao): Promise<void> {
    try {
      await this.publicador.publicar(evento);
    } catch (error) {
      this.logger.error(
        `Falha ao publicar ${evento.constructor.name} da OS ${evento.ordemServicoId} (eventId ${evento.eventId}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
