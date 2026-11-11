import { HistoricoStatus } from '../entities/historico-status.entity';

export interface IStatusHistoryRepository {
  create(historico: HistoricoStatus): Promise<HistoricoStatus>;
  findByOrdemServicoId(ordemServicoId: string): Promise<HistoricoStatus[]>;
}
