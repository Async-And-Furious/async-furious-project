import { Injectable } from '@nestjs/common';
import { Peca } from '../../domain/entities/peca.entity';
import type { IPecaRepository } from '../../domain/interfaces/peca.interface';

@Injectable()
export class CreatePecaUseCase {
  constructor(private readonly repository: IPecaRepository) {}

  async execute(data: {
    nome: string;
    codigo: string;
    descricao?: string;
    preco: number;
    quantidade_estoque?: number;
    quantidade_minima?: number;
  }): Promise<Peca> {
    return this.repository.create(data);
  }
}

@Injectable()
export class ListPecasUseCase {
  constructor(private readonly repository: IPecaRepository) {}

  async execute(
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<{
    data: Peca[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.repository.findAll(page, limit, search);
  }
}

@Injectable()
export class GetPecaUseCase {
  constructor(private readonly repository: IPecaRepository) {}

  async execute(id: string): Promise<Peca> {
    return this.repository.findOne(id);
  }
}

@Injectable()
export class UpdatePecaUseCase {
  constructor(private readonly repository: IPecaRepository) {}

  async execute(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number; quantidade_minima?: number },
  ): Promise<Peca> {
    return this.repository.update(id, data);
  }
}

@Injectable()
export class UpdateEstoquePecaUseCase {
  constructor(private readonly repository: IPecaRepository) {}

  async execute(id: string, quantidade: number): Promise<Peca> {
    return this.repository.updateEstoque(id, quantidade);
  }
}

@Injectable()
export class DeletePecaUseCase {
  constructor(private readonly repository: IPecaRepository) {}

  async execute(id: string): Promise<Peca> {
    return this.repository.remove(id);
  }
}
