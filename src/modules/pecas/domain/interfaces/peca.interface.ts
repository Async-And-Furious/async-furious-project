import { Peca } from '../entities/peca.entity';

export interface IPecaRepository {
  create(data: {
    nome: string;
    codigo: string;
    descricao?: string;
    preco: number;
    quantidade_estoque?: number;
    quantidade_minima?: number;
  }): Promise<Peca>;
  findAll(
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<{
    data: Peca[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findOne(id: string): Promise<Peca>;
  update(
    id: string,
    data: {
      nome?: string;
      descricao?: string;
      preco?: number;
      quantidade_minima?: number;
    },
  ): Promise<Peca>;
  updateEstoque(id: string, quantidade: number): Promise<Peca>;
  remove(id: string): Promise<Peca>;
}
