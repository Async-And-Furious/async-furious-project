import { Decimal } from '@prisma/client/runtime/library';

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
  valor_total_servicos: Decimal;
  valor_total_pecas: Decimal;
  valor_total_geral: Decimal;
  orcamento_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  orcamento_aprovado: boolean;
  created_at: Date;
  updated_at: Date;
  entregueEm: Date | null;
}
