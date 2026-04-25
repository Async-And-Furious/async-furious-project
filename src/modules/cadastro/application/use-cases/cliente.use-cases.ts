import { BadRequestException } from '@nestjs/common';
import { Cliente } from '../../domain/entities/cliente.entity';
import type { IClienteRepository } from '../../domain/interfaces/cliente.interface';
import { CpfCnpjVo } from '../../domain/value-objects/cpf-cnpj.vo';

export class CreateClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(data: {
    nome: string;
    email: string;
    telefone?: string;
    documento: string;
    tipo_documento: 'CPF' | 'CNPJ';
  }): Promise<Cliente> {
    const isValidDocumento =
      data.tipo_documento === 'CPF'
        ? CpfCnpjVo.validateCPF(data.documento)
        : CpfCnpjVo.validateCNPJ(data.documento);

    if (!isValidDocumento) {
      throw new BadRequestException('Documento invalido para o tipo_documento informado');
    }

    const documentoFormatado = CpfCnpjVo.formatByType(data.documento, data.tipo_documento);

    return this.repository.create({
      ...data,
      documento: documentoFormatado,
    });
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

export class GetClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(id: string): Promise<Cliente> {
    return this.repository.findOne(id);
  }
}

export class UpdateClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(
    id: string,
    data: { nome?: string; email?: string; telefone?: string }
  ): Promise<Cliente> {
    return this.repository.update(id, data);
  }
}

export class DeleteClienteUseCase {
  constructor(private readonly repository: IClienteRepository) {}

  async execute(id: string): Promise<Cliente> {
    return this.repository.remove(id);
  }
}
