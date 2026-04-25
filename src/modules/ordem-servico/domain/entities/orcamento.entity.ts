export class Orcamento {
  id: string;
  id_ordem_servico: string;
  valor_total_servicos: number;
  valor_total_pecas: number;
  valor_total_geral: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: Date;
  updated_at: Date;
}
