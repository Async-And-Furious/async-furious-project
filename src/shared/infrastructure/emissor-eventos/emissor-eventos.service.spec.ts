import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmissorEventos } from './emissor-eventos.service';
import { DomainEvent } from '../../domain/events/domain-event.base';

class EventoTeste extends DomainEvent {
  constructor(public readonly dado: string) {
    super();
  }
}

describe('EmissorEventos', () => {
  it('deve chamar emitAsync com o nome da classe do evento e o evento', async () => {
    const mockEventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as EventEmitter2;
    const emissor = new EmissorEventos(mockEventEmitter);
    const evento = new EventoTeste('teste');

    await emissor.emitir(evento);

    expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith('EventoTeste', evento);
  });
});
