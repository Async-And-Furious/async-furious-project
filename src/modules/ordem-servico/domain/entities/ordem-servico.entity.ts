import type { Orcamento } from './orcamento.entity';

export class OrdemDeServico {
  id: string;
  veiculoId: string;
  clienteId: string;
  status:
    | 'RECEIVED'
    | 'UNDER_DIAGNOSIS'
    | 'AWAITING_APPROVAL'
    | 'IN_PROGRESS'
    | 'FINISHED'
    | 'DELIVERED';
  descricao: string | null;
  created_at: Date;
  updated_at: Date;
  entregue_em: Date | null;
  orcamento?: Orcamento;
}
