import { OrdemDeServico } from '../entities/ordem-servico.entity';

export interface IOrdemServicoRepository {
  create(data: {
    vehicle_id: string;
    customer_id: string;
    description?: string;
  }): Promise<OrdemDeServico>;
  findAll(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: OrdemDeServico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findOne(id: string): Promise<OrdemDeServico>;
  update(
    id: string,
    data: { status?: OrdemDeServico['status']; description?: string }
  ): Promise<OrdemDeServico>;
  remove(id: string): Promise<OrdemDeServico>;
}
