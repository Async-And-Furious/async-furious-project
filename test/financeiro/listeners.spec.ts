import { Test, TestingModule } from '@nestjs/testing';
import { AcionarEntregaOrdemServicoListener } from '../../src/modules/financeiro/infrastructure/listeners/acionar-entrega-ordem-servico.listener';
import { AcionarEntregaOrdemServicoHandler } from '../../src/modules/financeiro/application/event-handlers/acionar-entrega-ordem-servico.handler';
import { PagamentoRegistradoEvent } from '../../src/modules/financeiro/domain/events/pagamento-registrado.event';

describe('AcionarEntregaOrdemServicoListener', () => {
  let listener: AcionarEntregaOrdemServicoListener;
  let mockHandler: { handle: jest.Mock };

  beforeEach(async () => {
    mockHandler = { handle: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcionarEntregaOrdemServicoListener,
        { provide: AcionarEntregaOrdemServicoHandler, useValue: mockHandler },
      ],
    }).compile();

    listener = module.get<AcionarEntregaOrdemServicoListener>(AcionarEntregaOrdemServicoListener);
  });

  it('should delegate the event to the application handler', async () => {
    const evento = new PagamentoRegistradoEvent('pag-1', 'os-1');

    await listener.handle(evento);

    expect(mockHandler.handle).toHaveBeenCalledWith(evento);
  });
});
