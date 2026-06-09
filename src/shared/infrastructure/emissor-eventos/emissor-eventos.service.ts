import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '../../domain/events/domain-event.base';
import { IEmissorEventos } from '../../domain/interfaces/emissor-eventos.interface';

@Injectable()
export class EmissorEventos implements IEmissorEventos {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emitir(evento: DomainEvent): Promise<void> {
    await this.eventEmitter.emitAsync(evento.constructor.name, evento);
  }
}
