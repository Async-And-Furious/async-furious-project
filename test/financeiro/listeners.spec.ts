import { Test, TestingModule } from '@nestjs/testing';
import { AcionarEntregaOrdemServicoHandler } from '../../src/modules/financeiro/application/event-handlers/acionar-entrega-ordem-servico.handler';
import { PagamentoRegistradoEvent } from '../../src/modules/financeiro/domain/events/pagamento-registrado.event';
import { EMISSOR_EVENTOS } from '../../src/shared/domain/interfaces/emissor-eventos.interface';

describe('AcionarEntregaOrdemServicoHandler', () => {
  let handler: AcionarEntregaOrdemServicoHandler;
  let mockEmissor: { emitir: jest.Mock };

  beforeEach(async () => {
    mockEmissor = { emitir: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcionarEntregaOrdemServicoHandler,
        { provide: EMISSOR_EVENTOS, useValue: mockEmissor },
      ],
    }).compile();

    handler = module.get<AcionarEntregaOrdemServicoHandler>(AcionarEntregaOrdemServicoHandler);
  });

  it('should emit PagamentoRegistrado integration event', async () => {
    const evento = new PagamentoRegistradoEvent('pag-1', 'os-1');

    await handler.handle(evento);

    expect(mockEmissor.emitir).toHaveBeenCalledTimes(1);
    expect(mockEmissor.emitir).toHaveBeenCalledWith(
      expect.objectContaining({ ordemServicoId: 'os-1', pagamentoId: 'pag-1' })
    );
  });
});
