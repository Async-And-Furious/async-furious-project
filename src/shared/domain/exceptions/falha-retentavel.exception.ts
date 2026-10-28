import { DomainException } from './domain.exception';

// Evento que chegou antes do estado que ele pressupõe (ex.: ExecucaoIniciada com a OS ainda
// em UNDER_DIAGNOSIS). O consumidor deve deixar a entrega falhar para o ciclo de retry da
// mensageria (ADR-0018, "Classificação de falha no consumidor"); não é erro de negócio.
export class FalhaRetentavelException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'FalhaRetentavelException';
  }
}
