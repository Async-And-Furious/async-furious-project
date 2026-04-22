import { Cliente } from '../entities/cliente.entity';

export interface IClienteRepository {
  create(data: {
    nome: string;
    email: string;
    telefone?: string;
    documento: string;
    tipo_documento: 'CPF' | 'CNPJ';
  }): Promise<Cliente>;
  findAll(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Cliente[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findOne(id: string): Promise<Cliente>;
  update(id: string, data: { nome?: string; email?: string; telefone?: string }): Promise<Cliente>;
  remove(id: string): Promise<Cliente>;
}
