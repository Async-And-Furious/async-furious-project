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
 *
 * A publicação não é aguardada: o listener roda dentro do `emitAsync` do `EmissorEventos`, e
 * esperar o broker prenderia a requisição HTTP (criar OS, lançar serviços/insumos). A ordem dos
 * eventos da mesma OS se mantém: os `send` começam na ordem de emissão e o produtor idempotente
 * do kafkajs serializa os envios por broker.
 */
export class PonteEventosIntegracaoListener {
  private readonly logger = new Logger(PonteEventosIntegracaoListener.name);

  constructor(private readonly publicador: IPublicadorIntegracao) {}

  @OnEvent('OrdemServicoRecebida')
  onOrdemServicoRecebida(evento: OrdemServicoRecebida): void {
    this.publicar(evento);
  }

  @OnEvent('OrcamentoCalculado')
  onOrcamentoCalculado(evento: OrcamentoCalculado): void {
    this.publicar(evento);
  }

  // Só a falha detectada aqui sai pelo tópico do OS. Uma EtapaDaSagaFalhou de outro serviço,
  // recebida pelo consumidor e reemitida in-process, não volta ao broker (evita laço).
  @OnEvent('EtapaDaSagaFalhou')
  onEtapaDaSagaFalhou(evento: EtapaDaSagaFalhou): void {
    if (evento.servicoOrigem !== 'os-service') return;
    this.publicar(evento);
  }

  private publicar(evento: EventoIntegracao): void {
    void this.publicador.publicar(evento).catch((error: unknown) => {
      this.logger.error(
        `Falha ao publicar ${evento.constructor.name} da OS ${evento.ordemServicoId} (eventId ${evento.eventId}): ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }
}
