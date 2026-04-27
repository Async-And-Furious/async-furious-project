import { Cliente } from '../../domain/entities/cliente.entity';
import type { TipoDocumento } from '../../domain/value-objects/cpf-cnpj.vo';

export interface ClienteORMEntity {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  documento: string;
  tipo_documento: 'CPF' | 'CNPJ';
  created_at: Date;
  updated_at: Date;
}

export class ClienteMapper {
  static toDomain(orm: ClienteORMEntity): Cliente {
    return Cliente.criar({
      id: orm.id,
      nome: orm.nome,
      email: orm.email,
      telefone: orm.telefone || undefined,
      documento: orm.documento,
      tipoDocumento: orm.tipo_documento as TipoDocumento,
    });
  }

  static toOrm(cliente: Cliente): Omit<ClienteORMEntity, 'created_at' | 'updated_at'> {
    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.contato.email,
      telefone: cliente.contato.telefone,
      documento: cliente.cpfCnpj.valor,
      tipo_documento: cliente.cpfCnpj.tipo,
    };
  }
}
