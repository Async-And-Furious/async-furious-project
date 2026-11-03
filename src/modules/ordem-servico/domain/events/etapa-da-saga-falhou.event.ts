import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export type EtapaDaSaga =
  | 'diagnostico'
  | 'orcamento'
  | 'aprovacao-pagamento'
  | 'inicio-execucao'
  | 'reparo';

/**
 * Falha da saga (ADR-0018). Emitido in-process enquanto o produtor Kafka não existe;
 * o publicador de integração o levará a `os.eventos.v1`.
 */
export class EtapaDaSagaFalhou extends DomainEvent {
  constructor(
    public readonly servicoOrigem: 'os-service',
    public readonly eventTypeOriginal: string | null,
    public readonly ordemServicoId: string,
    public readonly etapa: EtapaDaSaga,
    public readonly motivo: string
  ) {
    super();
  }
}
