import { DomainEvent } from '../events/domain-event.base';

export const EMISSOR_EVENTOS = Symbol('EMISSOR_EVENTOS');

export interface IEmissorEventos {
  emitir(evento: DomainEvent): Promise<void>;
}
