import { ClienteMapper, ClienteORMEntity } from '../persistence/cliente.orm-entity';
import type { ClienteLeitura } from '../../domain/interfaces/cliente-read-model.interface';

// Documento da coleção cliente_read_model: _id é o id do Cliente no Postgres.
export interface ClienteReadModelDocument extends Omit<ClienteLeitura, 'id'> {
  _id: string;
}

// Mesmo builder no write-through e no rebuild; formata o documento pelo
// domínio, como o ClienteResponseDto faz hoje.
export function buildClienteReadModelDocument(orm: ClienteORMEntity): ClienteReadModelDocument {
  const cliente = ClienteMapper.toDomain(orm);
  return {
    _id: cliente.id,
    nome: cliente.nome,
    email: cliente.contato.email,
    telefone: cliente.contato.telefone,
    documento: cliente.cpfCnpj.formato,
    tipoDocumento: cliente.cpfCnpj.tipo,
  };
}

export function toClienteLeitura({ _id, ...rest }: ClienteReadModelDocument): ClienteLeitura {
  return { id: _id, ...rest };
}
