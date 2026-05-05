export interface OrdemServicoBacklogItem {
  ordemId: string;
  pecas: Array<{ pecaId: string; quantidadeNecessaria: number }>;
}

export interface IOrdemServicoBacklogPort {
  findAllAguardandoPecas(): Promise<OrdemServicoBacklogItem[]>;
}

export const ORDEM_SERVICO_BACKLOG_PORT = Symbol('ORDEM_SERVICO_BACKLOG_PORT');
