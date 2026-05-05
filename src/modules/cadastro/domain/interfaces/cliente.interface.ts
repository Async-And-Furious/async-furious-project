import { Cliente } from '../entities/cliente.entity';
import type { TipoDocumento } from '../value-objects/cpf-cnpj.vo';

export interface CreateClienteInput {
  nome: string;
  email: string;
  telefone?: string;
  documento: string;
  tipoDocumento: TipoDocumento;
}

export interface UpdateClienteInput {
  nome?: string;
  email?: string;
  telefone?: string;
}

export interface IClienteRepository {
  create(data: CreateClienteInput): Promise<Cliente>;
  findAll(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Cliente[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findById(id: string): Promise<Cliente>;
  update(id: string, data: UpdateClienteInput): Promise<Cliente>;
  remove(id: string): Promise<Cliente>;
}
