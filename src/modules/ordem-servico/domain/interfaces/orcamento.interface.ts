import { Orcamento } from '../entities/orcamento.entity';

export type OrcamentoUpdateData = {
  valor_total_servicos?: number;
  valor_total_pecas?: number;
  valor_total_geral?: number;
  status?: Orcamento['status'];
};

export interface IOrcamentoRepository {
  create(data: {
    id_ordem_servico: string;
    valor_total_servicos: number;
    valor_total_pecas: number;
    valor_total_geral: number;
  }): Promise<Orcamento>;
  findByOrdemServicoId(id_ordem_servico: string): Promise<Orcamento | null>;
  update(id: string, data: OrcamentoUpdateData): Promise<Orcamento>;
}
