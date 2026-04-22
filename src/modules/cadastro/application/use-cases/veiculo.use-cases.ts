import { Veiculo } from '../../domain/entities/veiculo.entity';
import { IVeiculoRepository } from '../../domain/interfaces/veiculo.interface';

export class CreateVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(data: {
    placa: string;
    marca: string;
    modelo: string;
    ano: number;
    cor?: string;
    id_cliente: string;
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
    data: { marca?: string; modelo?: string; ano?: number; cor?: string }
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
