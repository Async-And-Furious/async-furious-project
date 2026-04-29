import { PecaInsumo } from '../entities/peca-insumo.entity';

export interface IPecaInsumoRepository {
  create(data: {
    nome: string;
    codigo: string;
    descricao?: string;
    preco: number;
    quantidade_estoque?: number;
    quantidade_minima?: number;
  }): Promise<PecaInsumo>;
  findAll(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: PecaInsumo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findOne(id: string): Promise<PecaInsumo>;
  findByOrdemServicoId(ordemServicoId: string): Promise<
    Array<{
      id_peca: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
      quantidade_estoque: number;
      quantidade_minima: number;
    }>
  >;
  update(
    id: string,
    data: {
      nome?: string;
      descricao?: string;
      preco?: number;
      quantidade_minima?: number;
    }
  ): Promise<PecaInsumo>;
  updateEstoque(id: string, quantidade: number): Promise<PecaInsumo>;
  remove(id: string): Promise<PecaInsumo>;
}
