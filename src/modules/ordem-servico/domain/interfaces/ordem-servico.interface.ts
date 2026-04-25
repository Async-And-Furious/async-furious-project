import { OrdemDeServico } from '../entities/ordem-servico.entity';

export type OrdemServicoUpdateData = {
  status?: OrdemDeServico['status'];
  descricao?: string;
};

export interface IOrdemServicoRepository {
  create(data: {
    id_veiculo: string;
    id_cliente: string;
    descricao?: string;
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
  update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico>;
  remove(id: string): Promise<OrdemDeServico>;
}
