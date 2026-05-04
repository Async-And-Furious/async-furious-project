import { Test, TestingModule } from '@nestjs/testing';
import { PagamentoController } from '../../src/modules/financeiro/presentation/controllers/pagamento.controller';
import { RegistrarPagamentoPolicy } from '../../src/modules/financeiro/application/policies/registrar-pagamento.policy';

describe('PagamentoController', () => {
  let controller: PagamentoController;
  let mockPolicy: { execute: jest.Mock };

  beforeEach(async () => {
    mockPolicy = { execute: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagamentoController],
      providers: [{ provide: RegistrarPagamentoPolicy, useValue: mockPolicy }],
    }).compile();

    controller = module.get<PagamentoController>(PagamentoController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registrar', () => {
    it('should call policy.execute with correct data', async () => {
      const dto = {
        ordemServicoId: 'os-123',
        valor: 150.0,
      };

      const result = await controller.registrar(dto);

      expect(mockPolicy.execute).toHaveBeenCalledWith({
        ordemServicoId: 'os-123',
        valor: 150.0,
      });
      expect(result).toEqual({ message: 'Pagamento registrado com sucesso' });
    });

    it('should handle different values', async () => {
      const dto = {
        ordemServicoId: 'os-456',
        valor: 299.99,
      };

      await controller.registrar(dto);

      expect(mockPolicy.execute).toHaveBeenCalledWith({
        ordemServicoId: 'os-456',
        valor: 299.99,
      });
    });
  });
});
