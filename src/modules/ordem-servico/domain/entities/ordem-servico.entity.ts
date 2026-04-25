export class OrdemDeServico {
  id: string;
  id_veiculo: string;
  id_cliente: string;
  status:
    | 'RECEIVED'
    | 'UNDER_DIAGNOSIS'
    | 'AWAITING_APPROVAL'
    | 'IN_PROGRESS'
    | 'FINISHED'
    | 'DELIVERED';
  descricao: string | null;
  valor_total_servicos: number;
  valor_total_pecas: number;
  valor_total_geral: number;
  orcamento_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: Date;
  updated_at: Date;
  entregue_em: Date | null;
}
