import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export type EtapaDaSaga =
  | 'diagnostico'
  | 'orcamento'
  | 'aprovacao-pagamento'
  | 'inicio-execucao'
  | 'reparo';

export const ETAPAS_DA_SAGA: readonly EtapaDaSaga[] = [
  'diagnostico',
  'orcamento',
  'aprovacao-pagamento',
  'inicio-execucao',
  'reparo',
];

/**
 * Falha técnica da saga (ADR-0018). Publicado pelo OS em `os.eventos.v1` com
 * `servicoOrigem = "os-service"`; recebido do Billing e do Execução, com o `servicoOrigem`
 * deles, para a compensação (#338).
 */
export class EtapaDaSagaFalhou extends DomainEvent {
  constructor(
    public readonly servicoOrigem: string,
    public readonly eventTypeOriginal: string | null,
    public readonly ordemServicoId: string,
    public readonly etapa: EtapaDaSaga,
    public readonly motivo: string
  ) {
    super();
  }
}
