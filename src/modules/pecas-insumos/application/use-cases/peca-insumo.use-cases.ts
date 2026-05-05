import { PecaInsumo } from '../../domain/entities/peca-insumo.entity';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';

export class CreatePecaInsumoUseCase {
  constructor(private readonly repository: IPecaInsumoRepository) {}

  async execute(data: {
    nome: string;
    codigo: string;
    descricao?: string;
    preco: number;
    quantidade_estoque?: number;
    quantidade_minima?: number;
  }): Promise<PecaInsumo> {
    return this.repository.create(data);
  }
}

export class ListPecasInsumoUseCase {
  constructor(private readonly repository: IPecaInsumoRepository) {}

  async execute(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: PecaInsumo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.repository.findAll(page, limit, search);
  }
}

export class GetPecaInsumoUseCase {
  constructor(private readonly repository: IPecaInsumoRepository) {}

  async execute(id: string): Promise<PecaInsumo> {
    return this.repository.findOne(id);
  }
}

export class UpdatePecaInsumoUseCase {
  constructor(private readonly repository: IPecaInsumoRepository) {}

  async execute(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number; quantidade_minima?: number }
  ): Promise<PecaInsumo> {
    return this.repository.update(id, data);
  }
}

export class UpdateEstoquePecaInsumoUseCase {
  constructor(private readonly repository: IPecaInsumoRepository) {}

  async execute(id: string, quantidade: number): Promise<PecaInsumo> {
    return this.repository.updateEstoque(id, quantidade);
  }
}

export class DeletePecaInsumoUseCase {
  constructor(private readonly repository: IPecaInsumoRepository) {}

  async execute(id: string): Promise<PecaInsumo> {
    return this.repository.remove(id);
  }
}
