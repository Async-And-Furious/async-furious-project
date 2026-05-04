import { OsPeca } from '../entities/os-peca.entity';

export interface IOsPecaRepository {
  replaceAll(
    ordemServicoId: string,
    pecas: Array<{
      id_peca: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
    }>
  ): Promise<void>;
  findByOrdemServicoId(ordemServicoId: string): Promise<OsPeca[]>;
}
