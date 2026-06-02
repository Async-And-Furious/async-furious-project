import type { Orcamento } from './orcamento.entity';
import { OsPeca } from './os-peca.entity';
import { OsServico } from './os-servico.entity';

export type OSStatus =
  | 'RECEIVED'
  | 'UNDER_DIAGNOSIS'
  | 'AWAITING_APPROVAL'
  | 'IN_PROGRESS'
  | 'AWAITING_PARTS'
  | 'FINISHED'
  | 'DELIVERED'
  | 'CLOSED_WITHOUT_EXECUTION';

export class OrdemDeServico {
  id: string;
  veiculoId: string;
  clienteId: string;
  status: OSStatus;
  descricao: string | null;
  iniciada_em: Date | null;
  finalizada_em: Date | null;
  entregue_em: Date | null;
  created_at: Date;
  updated_at: Date;
  orcamento?: Orcamento;
  osPecas?: OsPeca[];
  osServicos?: OsServico[];
}
