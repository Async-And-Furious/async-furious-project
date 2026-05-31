import { Test, TestingModule } from '@nestjs/testing';
import { AcionarEntregaOrdemServicoListener } from '../../src/modules/financeiro/infrastructure/listeners/acionar-entrega-ordem-servico.listener';
import { AcionarEntregaOrdemServicoPolicy } from '../../src/modules/financeiro/application/policies/acionar-entrega-ordem-servico.policy';
import { PagamentoRegistradoEvent } from '../../src/modules/financeiro/domain/events/pagamento-registrado.event';

describe('AcionarEntregaOrdemServicoListener', () => {
  let listener: AcionarEntregaOrdemServicoListener;
  let mockPolicy: { handle: jest.Mock };

  beforeEach(async () => {
    mockPolicy = { handle: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcionarEntregaOrdemServicoListener,
        { provide: AcionarEntregaOrdemServicoPolicy, useValue: mockPolicy },
      ],
    }).compile();

    listener = module.get<AcionarEntregaOrdemServicoListener>(AcionarEntregaOrdemServicoListener);
  });

  it('should delegate the event to the application policy', async () => {
    const evento = new PagamentoRegistradoEvent('pag-1', 'os-1');

    await listener.handle(evento);

    expect(mockPolicy.handle).toHaveBeenCalledWith(evento);
  });
});
