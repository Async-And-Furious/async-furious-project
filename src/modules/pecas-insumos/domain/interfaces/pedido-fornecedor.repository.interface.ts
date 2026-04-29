import { PedidoFornecedor } from '../entities/pedido-fornecedor.entity';

export interface IPedidoFornecedorRepository {
  create(data: {
    fornecedor_id: string;
    itens: Array<{ id_peca: string; quantidade_solicitada: number }>;
    status: 'PENDENTE';
    criado_em: Date;
  }): Promise<PedidoFornecedor>;
  findById(id: string): Promise<PedidoFornecedor | null>;
  save(pedido: PedidoFornecedor): Promise<PedidoFornecedor>;
  findAll(): Promise<PedidoFornecedor[]>;
}
