// Este mock "engana" o Jest para que ele não tente carregar o cliente real do Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

// Mock do PrismaService para evitar que ele tente conectar à base de dados
jest.mock('../../src/shared/infrastructure/database/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { RegistrarPagamentoPolicy } from '../../src/modules/financeiro/application/policies/registrar-pagamento.policy';
import { AcionarEntregaOrdemServicoPolicy } from '../../src/modules/financeiro/application/policies/acionar-entrega-ordem-servico.policy';
import { PagamentoRepository } from '../../src/modules/financeiro/infrastructure/repositories/pagamento.repository';
import { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { PagamentoRegistradoEvent } from '../../src/modules/financeiro/domain/events/pagamento-registrado.event';

describe('Módulo Financeiro: Policies de Fluxo', () => {
  let mockRepository: jest.Mocked<PagamentoRepository>;
  let mockEmissor: jest.Mocked<EmissorEventos>;

  beforeEach(() => {
    mockRepository = { save: jest.fn(), findById: jest.fn() } as any;
    mockEmissor = { emitir: jest.fn() } as any;
  });

  describe('RegistrarPagamentoPolicy (P-26)', () => {
    let policy: RegistrarPagamentoPolicy;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RegistrarPagamentoPolicy,
          { provide: PagamentoRepository, useValue: mockRepository },
          { provide: EmissorEventos, useValue: mockEmissor },
        ],
      }).compile();
      policy = module.get<RegistrarPagamentoPolicy>(RegistrarPagamentoPolicy);
    });

    it('deve persistir pagamento e emitir evento de sucesso', async () => {
      await policy.execute({ ordemServicoId: 'os-1', valor: 100 });

      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockEmissor.emitir).toHaveBeenCalledWith(expect.any(PagamentoRegistradoEvent));
    });
  });

  describe('AcionarEntregaOrdemServicoPolicy (P-27)', () => {
    let policy: AcionarEntregaOrdemServicoPolicy;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AcionarEntregaOrdemServicoPolicy,
          { provide: EmissorEventos, useValue: mockEmissor },
        ],
      }).compile();
      policy = module.get<AcionarEntregaOrdemServicoPolicy>(AcionarEntregaOrdemServicoPolicy);
    });

    it('deve traduzir o evento interno para o contrato de integração da OS', async () => {
      const eventoInterno = new PagamentoRegistradoEvent('pag-id', 'os-id');

      await policy.handle(eventoInterno);

      // Usamos 'as any' para validar propriedades que o TypeScript ainda não conhece (Cross-Module)
      const eventoPublicado = mockEmissor.emitir.mock.calls[0][0] as any;

      expect(eventoPublicado.ordemServicoId).toBe('os-id');
      expect(eventoPublicado.pagamentoId).toBe('pag-id');
      expect(eventoPublicado.eventId).toBeDefined();
    });
  });
});
