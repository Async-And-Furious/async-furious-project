import { ReservaEstoque } from '../entities/reserva-estoque.entity';

export interface IReservaEstoqueRepository {
  save(reserva: { ordem_id: string; peca_id: string; quantidade: number }): Promise<ReservaEstoque>;
  existsByOrdemId(ordemId: string): Promise<boolean>;
  findByOrdemId(ordemId: string): Promise<ReservaEstoque[]>;
}
