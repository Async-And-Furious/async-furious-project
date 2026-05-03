import {
  ClienteResponseDto,
  ClienteListResponseDto,
} from '../../presentation/dto/cliente.response.dto';
import type { IClienteRepository } from '../../domain/interfaces/cliente.interface';
import type {
  CreateClienteInput,
  UpdateClienteInput,
} from '../../domain/interfaces/cliente.interface';

export class CreateClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(data: CreateClienteInput): Promise<ClienteResponseDto> {
    const cliente = await this.repository.create(data);
    return ClienteResponseDto.fromDomain(cliente);
  }
}

export class ListClientesUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(page?: number, limit?: number, search?: string): Promise<ClienteListResponseDto> {
    const result = await this.repository.findAll(page, limit, search);
    return ClienteListResponseDto.fromDomain(result.data, result.pagination);
  }
}

export class GetClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(id: string): Promise<ClienteResponseDto> {
    const cliente = await this.repository.findById(id);
    return ClienteResponseDto.fromDomain(cliente);
  }
}

export class UpdateClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(id: string, data: UpdateClienteInput): Promise<ClienteResponseDto> {
    const cliente = await this.repository.update(id, data);
    return ClienteResponseDto.fromDomain(cliente);
  }
}

export class DeleteClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(id: string): Promise<ClienteResponseDto> {
    const cliente = await this.repository.remove(id);
    return ClienteResponseDto.fromDomain(cliente);
  }
}
