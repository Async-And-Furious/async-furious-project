import {
  VeiculoResponseDto,
  VeiculoListResponseDto,
} from '../../presentation/dto/veiculo.response.dto';
import type { IVeiculoRepository } from '../../domain/interfaces/veiculo.interface';
import type {
  CreateVeiculoInput,
  UpdateVeiculoInput,
} from '../../domain/interfaces/veiculo.interface';

export class CreateVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(data: CreateVeiculoInput): Promise<VeiculoResponseDto> {
    const veiculo = await this.repository.create(data);
    return VeiculoResponseDto.fromDomain(veiculo);
  }
}

export class ListVeiculosUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(page?: number, limit?: number, search?: string): Promise<VeiculoListResponseDto> {
    const result = await this.repository.findAll(page, limit, search);
    return VeiculoListResponseDto.fromDomain(result.data, result.pagination);
  }
}

export class GetVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(id: string): Promise<VeiculoResponseDto> {
    const veiculo = await this.repository.findById(id);
    return VeiculoResponseDto.fromDomain(veiculo);
  }
}

export class UpdateVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(id: string, data: UpdateVeiculoInput): Promise<VeiculoResponseDto> {
    const veiculo = await this.repository.update(id, data);
    return VeiculoResponseDto.fromDomain(veiculo);
  }
}

export class DeleteVeiculoUseCase {
  constructor(private readonly repository: IVeiculoRepository) {}

  async execute(id: string): Promise<VeiculoResponseDto> {
    const veiculo = await this.repository.remove(id);
    return VeiculoResponseDto.fromDomain(veiculo);
  }
}
