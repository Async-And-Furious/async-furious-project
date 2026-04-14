import { OrdemDeServico } from '../../domain/entities/ordem-de-servico.entity';
import { IOrdemDeServicoRepository } from '../../domain/interfaces/ordem-de-servico.interface';

export class CreateOrdemDeServicoUseCase {
  constructor(private readonly repository: IOrdemDeServicoRepository) {}

  async execute(data: {
    vehicle_id: string;
    customer_id: string;
    description?: string;
  }): Promise<OrdemDeServico> {
    return this.repository.create(data);
  }
}

export class ListOrdensDeServicoUseCase {
  constructor(private readonly repository: IOrdemDeServicoRepository) {}

  async execute(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: OrdemDeServico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.repository.findAll(page, limit, search);
  }
}

export class GetOrdemDeServicoUseCase {
  constructor(private readonly repository: IOrdemDeServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    return this.repository.findOne(id);
  }
}

export class UpdateOrdemDeServicoUseCase {
  constructor(private readonly repository: IOrdemDeServicoRepository) {}

  async execute(
    id: string,
    data: { status?: OrdemDeServico['status']; description?: string }
  ): Promise<OrdemDeServico> {
    return this.repository.update(id, data);
  }
}

export class DeleteOrdemDeServicoUseCase {
  constructor(private readonly repository: IOrdemDeServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    return this.repository.remove(id);
  }
}
