import { Cliente } from '../../domain/entities/cliente.entity';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import type { IClienteRepository } from '../../domain/interfaces/cliente.interface';
import type {
  ClienteLeitura,
  IClienteReadModelQuery,
} from '../../domain/interfaces/cliente-read-model.interface';
import type {
  CreateClienteInput,
  UpdateClienteInput,
} from '../../domain/interfaces/cliente.interface';

export class CreateClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(data: CreateClienteInput): Promise<Cliente> {
    return this.repository.create(data);
  }
}

export class ListClientesUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Cliente[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.repository.findAll(page, limit, search);
  }
}

// GET /clientes/:id é servido pelo read model (DocumentDB).
export class GetClienteUseCase {
  constructor(private readonly readModel: IClienteReadModelQuery) {}

  async execute(id: string): Promise<ClienteLeitura> {
    const cliente = await this.readModel.findById(id);
    if (!cliente) throw new EntityNotFoundException('Cliente', id);
    return cliente;
  }
}

export class UpdateClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(id: string, data: UpdateClienteInput): Promise<Cliente> {
    return this.repository.update(id, data);
  }
}

export class DeleteClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(id: string): Promise<Cliente> {
    return this.repository.remove(id);
  }
}
