import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';

export class CreateOrdemServicoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(data: {
    id_veiculo: string;
    id_cliente: string;
    descricao?: string;
  }): Promise<OrdemDeServico> {
    return this.repository.create(data);
  }
}

export class ListOrdensServicoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

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

export class GetOrdemServicoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    return this.repository.findOne(id);
  }
}

export class UpdateOrdemServicoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(
    id: string,
    data: { status?: OrdemDeServico['status']; descricao?: string }
  ): Promise<OrdemDeServico> {
    return this.repository.update(id, data);
  }
}

export class DeleteOrdemServicoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    return this.repository.remove(id);
  }
}
