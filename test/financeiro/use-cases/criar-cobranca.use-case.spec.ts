import { CriarCobrancaUseCase } from '../../../src/modules/financeiro/application/use-cases/criar-cobranca.use-case';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
} from '../../../src/modules/financeiro/domain/interfaces/pagamento.interface';

describe('CriarCobrancaUseCase', () => {
  let mockRepository: jest.Mocked<IPagamentoRepository>;
  let mockGateway: jest.Mocked<IGatewayPagamento>;
  let useCase: CriarCobrancaUseCase;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findCobrancaByOrdemServicoId: jest.fn().mockResolvedValue(null),
    };
    mockGateway = {
      criarCobranca: jest.fn().mockResolvedValue({
        preferenceId: 'pref-1',
        linkPagamento: 'https://mp.test/checkout/pref-1',
      }),
    };
    useCase = new CriarCobrancaUseCase(mockRepository, mockGateway);
  });

  it('deve criar a preference e persistir o pagamento aguardando pagamento', async () => {
    const link = await useCase.execute({ ordemServicoId: 'os-1', valor: 150 });

    expect(link).toBe('https://mp.test/checkout/pref-1');
    expect(mockGateway.criarCobranca).toHaveBeenCalledWith('os-1', 150);
    const salvo = mockRepository.save.mock.calls[0][0];
    expect(salvo.getStatus()).toBe('AGUARDANDO_PAGAMENTO');
    expect(salvo.getOrdemServicoId()).toBe('os-1');
    expect(salvo.getPreferenceId()).toBe('pref-1');
    expect(salvo.getLinkPagamento()).toBe('https://mp.test/checkout/pref-1');
  });

  it('deve devolver o link existente sem criar nova preference', async () => {
    mockRepository.findCobrancaByOrdemServicoId.mockResolvedValue(
      Pagamento.reconstituir({
        id: 'pag-1',
        ordemServicoId: 'os-1',
        valor: 150,
        status: 'AGUARDANDO_PAGAMENTO',
        preferenceId: 'pref-antiga',
        linkPagamento: 'https://mp.test/checkout/pref-antiga',
      })
    );

    const link = await useCase.execute({ ordemServicoId: 'os-1', valor: 150 });

    expect(link).toBe('https://mp.test/checkout/pref-antiga');
    expect(mockGateway.criarCobranca).not.toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('não deve persistir nada quando o gateway falha', async () => {
    mockGateway.criarCobranca.mockRejectedValue(new Error('Mercado Pago indisponível'));

    await expect(useCase.execute({ ordemServicoId: 'os-1', valor: 150 })).rejects.toThrow(
      'Mercado Pago indisponível'
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar valor não positivo antes de chamar o gateway', async () => {
    await expect(useCase.execute({ ordemServicoId: 'os-1', valor: 0 })).rejects.toThrow(
      'Valor do pagamento deve ser positivo.'
    );
    expect(mockGateway.criarCobranca).not.toHaveBeenCalled();
  });
});
