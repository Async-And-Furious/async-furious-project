export interface ICobrancaPagamentoPort {
  gerarLinkPagamento(ordemServicoId: string, valor: number): Promise<string>;
}

export const COBRANCA_PAGAMENTO_PORT = Symbol('COBRANCA_PAGAMENTO_PORT');
