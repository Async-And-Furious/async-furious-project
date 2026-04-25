import { Veiculo } from '../../domain/entities/veiculo.entity';

export interface VeiculoORMEntity {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string | null;
  id_cliente: string;
  created_at: Date;
  updated_at: Date;
}

export class VeiculoMapper {
  static toDomain(orm: VeiculoORMEntity): Veiculo {
    return Veiculo.criar({
      id: orm.id,
      placa: orm.placa,
      marca: orm.marca,
      modelo: orm.modelo,
      ano: orm.ano,
      cor: orm.cor || undefined,
      clienteId: orm.id_cliente,
    });
  }

  static toOrm(veiculo: Veiculo): Omit<VeiculoORMEntity, 'created_at' | 'updated_at'> {
    return {
      id: veiculo.id,
      placa: veiculo.placa.valor,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      ano: veiculo.ano,
      cor: veiculo.cor,
      id_cliente: veiculo.clienteId,
    };
  }
}
