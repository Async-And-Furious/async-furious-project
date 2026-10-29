// Evento que chegou antes do estado que ele pressupõe (ex.: ExecucaoIniciada com a OS ainda
// em UNDER_DIAGNOSIS). O consumidor deve deixar a entrega falhar para o ciclo de retry da
// mensageria (ADR-0018, "Classificação de falha no consumidor"). Não é erro de negócio, por
// isso não herda de DomainException: o filtro HTTP responde 400 para DomainException.
export class FalhaRetentavelException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FalhaRetentavelException';
  }
}
