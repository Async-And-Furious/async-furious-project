import { Servico } from '../entities/servico.entity';

export interface IServicoRepository {
  create(data: {
    nome: string;
    descricao?: string;
    preco: number;
  }): Promise<Servico>;
  findAll(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Servico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findOne(id: string): Promise<Servico>;
  update(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number }
  ): Promise<Servico>;
  remove(id: string): Promise<Servico>;
}
