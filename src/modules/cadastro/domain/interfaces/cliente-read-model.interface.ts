import type { TipoDocumento } from '../value-objects/cpf-cnpj.vo';

export const CLIENTE_READ_MODEL_PROJECTOR = Symbol('CLIENTE_READ_MODEL_PROJECTOR');
export const CLIENTE_READ_MODEL_QUERY = Symbol('CLIENTE_READ_MODEL_QUERY');

// Write-through do Cliente: chamado pelo repository depois da escrita no Postgres.
export interface IClienteReadModelProjector {
  project(clienteId: string): Promise<void>;
}

// Documento plano no formato do ClienteResponseDto (sem veículos e sem OS).
export interface ClienteLeitura {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  documento: string;
  tipoDocumento: TipoDocumento;
}

export interface IClienteReadModelQuery {
  findById(id: string): Promise<ClienteLeitura | null>;
}
