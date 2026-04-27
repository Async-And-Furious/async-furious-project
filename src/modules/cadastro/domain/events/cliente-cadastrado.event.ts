import { Cliente } from '../entities/cliente.entity';

export interface ClienteCadastradoEventPayload {
  clienteId: string;
  nome: string;
  email: string;
  documento: string;
  tipoDocumento: 'CPF' | 'CNPJ';
  dataCadastro: Date;
}

export class ClienteCadastradoEvent {
  readonly eventType = 'CLIENTE_CADASTRADO';
  readonly occurredOn: Date;
  readonly payload: ClienteCadastradoEventPayload;

  constructor(cliente: Cliente) {
    this.occurredOn = new Date();
    this.payload = {
      clienteId: cliente.id,
      nome: cliente.nome,
      email: cliente.contato.email,
      documento: cliente.cpfCnpj.formato,
      tipoDocumento: cliente.cpfCnpj.tipo,
      dataCadastro: this.occurredOn,
    };
  }
}
