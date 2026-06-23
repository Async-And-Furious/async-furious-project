export interface EnviarPedidoFornecedorPayload {
  pedidoId: string;
  fornecedorId: string;
  itens: Array<{ pecaId: string; quantidadeSolicitada: number }>;
}

export interface IFornecedorGateway {
  enviarPedido(payload: EnviarPedidoFornecedorPayload): Promise<void>;
}

export const FORNECEDOR_GATEWAY = Symbol('FORNECEDOR_GATEWAY');
