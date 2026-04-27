import { Veiculo } from '../entities/veiculo.entity';

export interface CreateVeiculoInput {
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor?: string;
  clienteId: string;
}

export interface UpdateVeiculoInput {
  marca?: string;
  modelo?: string;
  ano?: number;
  cor?: string;
}

export interface IVeiculoRepository {
  create(data: CreateVeiculoInput): Promise<Veiculo>;
  findAll(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Veiculo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findById(id: string): Promise<Veiculo>;
  findByPlaca(placa: string): Promise<Veiculo | null>;
  update(id: string, data: UpdateVeiculoInput): Promise<Veiculo>;
  remove(id: string): Promise<Veiculo>;
}
