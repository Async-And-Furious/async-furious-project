export class PedidoFornecedorItem {
  id: string;
  id_pedido_fornecedor: string;
  id_peca: string;
  quantidade_solicitada: number;
  quantidade_recebida: number;
}

export class PedidoFornecedor {
  id: string;
  fornecedor_id: string;
  status: 'PENDENTE' | 'RECEBIDO';
  criado_em: Date;
  atualizado_em: Date;
  itens: PedidoFornecedorItem[];
}
