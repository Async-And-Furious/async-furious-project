jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/shared/infrastructure/database/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { RegistrarPagamentoUseCase } from '../../src/modules/financeiro/application/use-cases/registrar-pagamento.use-case';
import { AcionarEntregaOrdemServicoHandler } from '../../src/modules/financeiro/application/event-handlers/acionar-entrega-ordem-servico.handler';
import {
  IPagamentoEventPublisher,
  IPagamentoRepository,
  PAGAMENTO_REPOSITORY,
} from '../../src/modules/financeiro/domain/interfaces/pagamento.interface';
import { PagamentoRegistradoEvent } from '../../src/modules/financeiro/domain/events/pagamento-registrado.event';
import { PagamentoRegistrado } from '../../src/modules/ordem-servico/domain/events/pagamento-registrado.event';
import { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';

describe('Módulo Financeiro: Event handlers de Fluxo', () => {
  let mockRepository: jest.Mocked<IPagamentoRepository>;
  let mockEmissor: jest.Mocked<IPagamentoEventPublisher>;

  beforeEach(() => {
    mockRepository = { save: jest.fn(), findById: jest.fn() } as jest.Mocked<IPagamentoRepository>;
    mockEmissor = { emitir: jest.fn() } as jest.Mocked<IPagamentoEventPublisher>;
  });

  describe('RegistrarPagamentoUseCase (P-26)', () => {
    let useCase: RegistrarPagamentoUseCase;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: RegistrarPagamentoUseCase,
            useFactory: () => new RegistrarPagamentoUseCase(mockRepository, mockEmissor),
          },
          { provide: PAGAMENTO_REPOSITORY, useValue: mockRepository },
          { provide: EmissorEventos, useValue: mockEmissor },
        ],
      }).compile();
      useCase = module.get<RegistrarPagamentoUseCase>(RegistrarPagamentoUseCase);
    });

    it('deve persistir pagamento e emitir evento de sucesso', async () => {
      await useCase.execute({ ordemServicoId: 'os-1', valor: 100 });

      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockEmissor.emitir).toHaveBeenCalledWith(expect.any(PagamentoRegistradoEvent));
    });
  });

  describe('AcionarEntregaOrdemServicoHandler (P-27)', () => {
    let handler: AcionarEntregaOrdemServicoHandler;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AcionarEntregaOrdemServicoHandler,
          { provide: EmissorEventos, useValue: mockEmissor },
        ],
      }).compile();
      handler = module.get<AcionarEntregaOrdemServicoHandler>(AcionarEntregaOrdemServicoHandler);
    });

    it('deve traduzir o evento interno para o contrato de integração da OS', async () => {
      const eventoInterno = new PagamentoRegistradoEvent('pag-id', 'os-id');

      await handler.handle(eventoInterno);

      const eventoPublicado = mockEmissor.emitir.mock.calls[0][0] as PagamentoRegistrado;

      expect(eventoPublicado.ordemServicoId).toBe('os-id');
      expect(eventoPublicado.pagamentoId).toBe('pag-id');
      expect(eventoPublicado.eventId).toBeDefined();
    });

    it('deve cobrir branches do logger na criação do evento', async () => {
      const eventoInterno = new PagamentoRegistradoEvent('os-123', 'pag-456');
      mockEmissor.emitir.mockResolvedValue(undefined);

      await handler.handle(eventoInterno);

      expect(mockEmissor.emitir).toHaveBeenCalled();
    });

    it('deve cobrir branches do logger após emissão', async () => {
      const eventoInterno = new PagamentoRegistradoEvent('os-789', 'pag-101');
      mockEmissor.emitir.mockResolvedValue(undefined);

      await handler.handle(eventoInterno);

      expect(mockEmissor.emitir).toHaveBeenCalledTimes(1);
    });
  });
});
