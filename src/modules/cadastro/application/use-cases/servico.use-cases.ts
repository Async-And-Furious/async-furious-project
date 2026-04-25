import { Servico } from '../../domain/entities/servico.entity';
import { IServicoRepository } from '../../domain/interfaces/servico.interface';

export class CreateServicoUseCase {
  constructor(private readonly repository: IServicoRepository) {}

  async execute(data: {
    nome: string;
    descricao?: string;
    preco: number;
  }): Promise<Servico> {
    return this.repository.create(data);
  }
}

export class ListServicosUseCase {
  constructor(private readonly repository: IServicoRepository) {}

  async execute(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: Servico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.repository.findAll(page, limit, search);
  }
}

export class GetServicoUseCase {
  constructor(private readonly repository: IServicoRepository) {}

  async execute(id: string): Promise<Servico> {
    return this.repository.findOne(id);
  }
}

export class UpdateServicoUseCase {
  constructor(private readonly repository: IServicoRepository) {}

  async execute(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number }
  ): Promise<Servico> {
    return this.repository.update(id, data);
  }
}

export class DeleteServicoUseCase {
  constructor(private readonly repository: IServicoRepository) {}

  async execute(id: string): Promise<Servico> {
    return this.repository.remove(id);
  }
}
