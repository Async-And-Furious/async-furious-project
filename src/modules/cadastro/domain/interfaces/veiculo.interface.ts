import { Veiculo } from '../entities/veiculo.entity';

export interface IVeiculoRepository {
  create(data: {
    license_plate: string;
    brand: string;
    model: string;
    year: number;
    color?: string;
    customer_id: string;
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
  findByLicensePlate(license_plate: string): Promise<Veiculo | null>;
  update(
    id: string,
    data: { brand?: string; model?: string; year?: number; color?: string }
  ): Promise<Veiculo>;
  remove(id: string): Promise<Veiculo>;
}
