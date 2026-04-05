import { Cliente } from '../entities/cliente.entity';

export interface IClienteRepository {
  create(data: {
    name: string;
    email: string;
    phone?: string;
    tax_id: string;
    tax_id_type: 'CPF' | 'CNPJ';
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
  update(id: string, data: { name?: string; email?: string; phone?: string }): Promise<Cliente>;
  remove(id: string): Promise<Cliente>;
}
