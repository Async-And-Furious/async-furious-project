import { OsServico } from '../entities/os-servico.entity';

export interface IOsServicoRepository {
  replaceAll(
    ordemServicoId: string,
    servicos: Array<{
      id_servico: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
    }>
  ): Promise<void>;
  findByOrdemServicoId(ordemServicoId: string): Promise<OsServico[]>;
}
