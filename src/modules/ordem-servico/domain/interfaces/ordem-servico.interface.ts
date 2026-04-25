import { OrdemDeServico } from '../entities/ordem-servico.entity';

export type OrdemServicoUpdateData = {
  status?: OrdemDeServico['status'];
  descricao?: string;
  valor_total_servicos?: OrdemDeServico['valor_total_servicos'];
  valor_total_pecas?: OrdemDeServico['valor_total_pecas'];
  valor_total_geral?: OrdemDeServico['valor_total_geral'];
  orcamento_status?: OrdemDeServico['orcamento_status'];
  orcamento_aprovado?: boolean;
};

export interface IOrdemServicoRepository {
  create(data: {
    veiculoId: string;
    clienteId: string;
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
