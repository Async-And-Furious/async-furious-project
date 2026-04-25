import { Cliente } from '../../domain/entities/cliente.entity';

export class ClienteResponseDto {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  documento: string;
  tipoDocumento: 'CPF' | 'CNPJ';

  static fromDomain(cliente: Cliente): ClienteResponseDto {
    const dto = new ClienteResponseDto();
    dto.id = cliente.id;
    dto.nome = cliente.nome;
    dto.email = cliente.contato.email;
    dto.telefone = cliente.contato.telefone;
    dto.documento = cliente.cpfCnpj.formato;
    dto.tipoDocumento = cliente.cpfCnpj.tipo;
    return dto;
  }
}

export class ClienteListResponseDto {
  data: ClienteResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  static fromDomain(
    clientes: Cliente[],
    pagination: { page: number; limit: number; total: number; totalPages: number }
  ): ClienteListResponseDto {
    const dto = new ClienteListResponseDto();
    dto.data = clientes.map((c) => ClienteResponseDto.fromDomain(c));
    dto.pagination = pagination;
    return dto;
  }
}
