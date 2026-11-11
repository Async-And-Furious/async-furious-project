/**
 * Devolução ao estoque das peças reservadas para uma OS, usada pela compensação da saga (#338).
 * Implementada pelo `pecas-insumos`; consumida pelo OS Service.
 */
export interface IReservaEstoquePort {
  /**
   * Devolve ao estoque cada reserva da OS e apaga a linha, numa transação. Idempotente: só
   * devolve a reserva cuja linha conseguiu apagar. Retorna quantas reservas foram devolvidas.
   */
  releaseByOrdemId(ordemId: string): Promise<number>;
}

export const RESERVA_ESTOQUE_PORT = Symbol('RESERVA_ESTOQUE_PORT');
