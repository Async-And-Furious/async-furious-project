import { ReservaEstoque } from '../entities/reserva-estoque.entity';
import type { IReservaEstoquePort } from '../../../../shared/domain/interfaces/reserva-estoque.port';

export interface IReservaEstoqueRepository extends IReservaEstoquePort {
  save(reserva: { ordem_id: string; peca_id: string; quantidade: number }): Promise<ReservaEstoque>;
  existsByOrdemId(ordemId: string): Promise<boolean>;
  findByOrdemId(ordemId: string): Promise<ReservaEstoque[]>;
}
