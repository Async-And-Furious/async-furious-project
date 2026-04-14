import { Veiculo } from '../../domain/entities/veiculo.entity';
import { IVeiculoRepository } from '../../domain/interfaces/veiculo.interface';

export class CreateVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(data: {
    license_plate: string;
    brand: string;
    model: string;
    year: number;
    color?: string;
    customer_id: string;
  }): Promise<Veiculo> {
    return this.repository.create(data);
  }
}

export class ListVeiculosUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Veiculo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.repository.findAll(page, limit, search);
  }
}

export class GetVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(id: string): Promise<Veiculo> {
    return this.repository.findOne(id);
  }
}

export class UpdateVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(
    id: string,
    data: { brand?: string; model?: string; year?: number; color?: string }
  ): Promise<Veiculo> {
    return this.repository.update(id, data);
  }
}

export class DeleteVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(id: string): Promise<Veiculo> {
    return this.repository.remove(id);
  }
}
