import { OrdemDeServico, OSStatus } from '../entities/ordem-servico.entity';

export type OrdemServicoUpdateData = {
  status?: OSStatus;
  descricao?: string;
  iniciada_em?: Date | null;
  finalizada_em?: Date | null;
  entregue_em?: Date | null;
  // Registrado em HistoricoStatusOS quando a escrita muda o status.
  motivo?: string;
  reserva_pecas_pendente?: boolean;
  pago_em?: Date | null;
};

// Condição checada no próprio UPDATE (where), não numa leitura anterior.
// `pago_em: null` casa só com OS ainda sem pagamento registrado.
export type OrdemServicoCondicao = Pick<
  OrdemServicoUpdateData,
  'status' | 'reserva_pecas_pendente' | 'pago_em'
>;

export interface IOrdemServicoRepository {
  create(data: {
    veiculoId: string;
    clienteId: string;
    descricao?: string;
  }): Promise<OrdemDeServico>;
  findOne(id: string): Promise<OrdemDeServico>;
  update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico>;
  /** Grava só se a OS ainda satisfaz a condição; devolve false se nenhuma linha casou. */
  atualizarSeCondicao(
    id: string,
    condicao: OrdemServicoCondicao,
    data: OrdemServicoUpdateData
  ): Promise<boolean>;
  /** OS em AWAITING_APPROVAL, sem pagamento e sem atualização desde `limite` (detector). */
  findParadasAguardandoAprovacao(limite: Date): Promise<OrdemDeServico[]>;
  remove(id: string): Promise<OrdemDeServico>;
  calcularTempoMedioExecucao(): Promise<{ totalMinutos: number; total: number }>;
}
