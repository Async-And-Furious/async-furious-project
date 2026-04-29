import { OrdemDeServico, OSStatus } from '../entities/ordem-servico.entity';

export type OrdemServicoUpdateData = {
  status?: OSStatus;
  descricao?: string;
  iniciada_em?: Date | null;
  finalizada_em?: Date | null;
  entregue_em?: Date | null;
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
