import { OrdemDeServico, OSStatus } from '../entities/ordem-servico.entity';

export type OrdemServicoUpdateData = {
  status?: OSStatus;
  descricao?: string;
  iniciada_em?: Date | null;
  finalizada_em?: Date | null;
  entregue_em?: Date | null;
  reserva_pecas_pendente?: boolean;
};

// Condição checada no próprio UPDATE (where), não numa leitura anterior.
export type OrdemServicoCondicao = Pick<
  OrdemServicoUpdateData,
  'status' | 'reserva_pecas_pendente'
>;

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
  findAllAtivas(
    page?: number,
    limit?: number
  ): Promise<{
    data: OrdemDeServico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findOne(id: string): Promise<OrdemDeServico>;
  update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico>;
  /** Grava só se a OS ainda satisfaz a condição; devolve false se nenhuma linha casou. */
  atualizarSeCondicao(
    id: string,
    condicao: OrdemServicoCondicao,
    data: OrdemServicoUpdateData
  ): Promise<boolean>;
  remove(id: string): Promise<OrdemDeServico>;
  calcularTempoMedioExecucao(): Promise<{ totalMinutos: number; total: number }>;
}
