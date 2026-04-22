import { Veiculo } from '../entities/veiculo.entity';

export interface IVeiculoRepository {
  create(data: {
    placa: string;
    marca: string;
    modelo: string;
    ano: number;
    cor?: string;
    id_cliente: string;
  }): Promise<Veiculo>;
  findAll(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Veiculo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findOne(id: string): Promise<Veiculo>;
  findByPlaca(placa: string): Promise<Veiculo | null>;
  update(
    id: string,
    data: { marca?: string; modelo?: string; ano?: number; cor?: string }
  ): Promise<Veiculo>;
  remove(id: string): Promise<Veiculo>;
}
