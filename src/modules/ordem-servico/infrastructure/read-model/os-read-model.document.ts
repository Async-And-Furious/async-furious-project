import { getPrioridadeStatus } from '../../domain/policies/status-priority.policy';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import type {
  OrdemServicoLeitura,
  StatusOrdemServicoLeitura,
} from '../../domain/interfaces/os-read-model.interface';

// Documento da coleção os_read_model: _id é o id da OS no Postgres; cliente e
// veículo embutidos (foto do momento da projeção); sem itens, histórico ou orçamento.
export interface OsReadModelDocument {
  _id: string;
  status: OSStatus;
  descricao: string | null;
  prioridade: number;
  createdAt: Date;
  updatedAt: Date;
  marcos: {
    createdAt: Date;
    iniciadaEm: Date | null;
    finalizadaEm: Date | null;
    entregueEm: Date | null;
  };
  cliente: { id: string; nome: string; documento: string };
  veiculo: { id: string; placa: string; marca: string; modelo: string };
}

export interface OrdemServicoProjetavel {
  id: string;
  status: string;
  descricao: string | null;
  iniciada_em: Date | null;
  finalizada_em: Date | null;
  entregue_em: Date | null;
  created_at: Date;
  updated_at: Date;
  cliente: { id: string; nome: string; documento: string };
  veiculo: { id: string; placa: string; marca: string; modelo: string };
}

// Inclusão Prisma usada pelo write-through e pelo rebuild (mesmo builder).
export const OS_PROJECAO_INCLUDE = {
  cliente: { select: { id: true, nome: true, documento: true } },
  veiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
} as const;

export function buildOsReadModelDocument(os: OrdemServicoProjetavel): OsReadModelDocument {
  const status = os.status as OSStatus;
  return {
    _id: os.id,
    status,
    descricao: os.descricao,
    prioridade: getPrioridadeStatus(status),
    createdAt: os.created_at,
    updatedAt: os.updated_at,
    marcos: {
      createdAt: os.created_at,
      iniciadaEm: os.iniciada_em,
      finalizadaEm: os.finalizada_em,
      entregueEm: os.entregue_em,
    },
    cliente: { id: os.cliente.id, nome: os.cliente.nome, documento: os.cliente.documento },
    veiculo: {
      id: os.veiculo.id,
      placa: os.veiculo.placa,
      marca: os.veiculo.marca,
      modelo: os.veiculo.modelo,
    },
  };
}

export function toOrdemServicoLeitura(doc: OsReadModelDocument): OrdemServicoLeitura {
  return {
    id: doc._id,
    clienteId: doc.cliente.id,
    veiculoId: doc.veiculo.id,
    status: doc.status,
    descricao: doc.descricao,
    iniciada_em: doc.marcos.iniciadaEm,
    finalizada_em: doc.marcos.finalizadaEm,
    entregue_em: doc.marcos.entregueEm,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    cliente: doc.cliente,
    veiculo: doc.veiculo,
  };
}

export function toStatusLeitura(doc: OsReadModelDocument): StatusOrdemServicoLeitura {
  return { ordemServicoId: doc._id, status: doc.status, marcos: doc.marcos };
}
