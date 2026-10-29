import type { OSStatus } from '../entities/ordem-servico.entity';

export const OS_READ_MODEL_PROJECTOR = Symbol('OS_READ_MODEL_PROJECTOR');
export const OS_READ_MODEL_QUERY = Symbol('OS_READ_MODEL_QUERY');

// Porta de write-through: chamada pelo repository depois da transação no
// Postgres. A implementação relê o agregado e substitui o documento inteiro
// (ou remove, se a OS não existe mais); falha não pode derrubar o request.
export interface IOsReadModelProjector {
  project(ordemServicoId: string): Promise<void>;
}

export interface OsMarcosLeitura {
  createdAt: Date;
  iniciadaEm: Date | null;
  finalizadaEm: Date | null;
  entregueEm: Date | null;
}

// Visão de leitura da OS servida pelo read model: sem itens, histórico ou orçamento.
export interface OrdemServicoLeitura {
  id: string;
  clienteId: string;
  veiculoId: string;
  status: OSStatus;
  descricao: string | null;
  iniciada_em: Date | null;
  finalizada_em: Date | null;
  entregue_em: Date | null;
  created_at: Date;
  updated_at: Date;
  cliente: { id: string; nome: string; documento: string };
  veiculo: { id: string; placa: string; marca: string; modelo: string };
}

export interface StatusOrdemServicoLeitura {
  ordemServicoId: string;
  status: OSStatus;
  marcos: OsMarcosLeitura;
}

export interface FilaOrdensServicoPagina {
  data: OrdemServicoLeitura[];
  pagination: { limit: number; nextCursor: string | null };
}

export interface IOsReadModelQuery {
  listarFila(limit: number, cursor?: string): Promise<FilaOrdensServicoPagina>;
  detalhar(id: string): Promise<OrdemServicoLeitura | null>;
  consultarStatus(id: string): Promise<StatusOrdemServicoLeitura | null>;
}
