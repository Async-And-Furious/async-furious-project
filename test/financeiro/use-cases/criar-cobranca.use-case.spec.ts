import { CriarCobrancaUseCase } from '../../../src/modules/financeiro/application/use-cases/criar-cobranca.use-case';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
} from '../../../src/modules/financeiro/domain/interfaces/pagamento.interface';
import { ConflitoException } from '../../../src/shared/domain/exceptions/conflito.exception';

const SEM_ESPERA = { tentativas: 2, intervaloMs: 0 };

const makePagamento = (overrides: { status?: string; linkPagamento?: string | null } = {}) =>
  Pagamento.reconstituir({
    id: 'pag-existente',
    ordemServicoId: 'os-1',
    valor: 150,
    status: overrides.status ?? 'AGUARDANDO_PAGAMENTO',
    preferenceId: overrides.linkPagamento ? 'pref-antiga' : null,
    linkPagamento: overrides.linkPagamento ?? null,
  });

describe('CriarCobrancaUseCase', () => {
  let mockRepository: jest.Mocked<IPagamentoRepository>;
  let mockGateway: jest.Mocked<IGatewayPagamento>;
  let useCase: CriarCobrancaUseCase;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findByOrdemServicoId: jest.fn().mockResolvedValue(null),
      reservar: jest.fn().mockResolvedValue(true),
      remover: jest.fn().mockResolvedValue(undefined),
      saveComNotificacao: jest.fn(),
    };
    mockGateway = {
      criarCobranca: jest.fn().mockResolvedValue({
        preferenceId: 'pref-1',
        linkPagamento: 'https://mp.test/checkout/pref-1',
      }),
      consultarPagamento: jest.fn(),
    };
    useCase = new CriarCobrancaUseCase(mockRepository, mockGateway, SEM_ESPERA);
  });

  it('deve reservar o pagamento antes de criar a preference e gravar o link', async () => {
    const link = await useCase.execute({ ordemServicoId: 'os-1', valor: 150 });

    expect(link).toBe('https://mp.test/checkout/pref-1');
    const reservado = mockRepository.reservar.mock.calls[0][0];
    expect(reservado.getOrdemServicoId()).toBe('os-1');
    expect(mockRepository.reservar.mock.invocationCallOrder[0]).toBeLessThan(
      mockGateway.criarCobranca.mock.invocationCallOrder[0]
    );
    const salvo = mockRepository.save.mock.calls[0][0];
    expect(salvo.getStatus()).toBe('AGUARDANDO_PAGAMENTO');
    expect(salvo.getPreferenceId()).toBe('pref-1');
    expect(salvo.getLinkPagamento()).toBe('https://mp.test/checkout/pref-1');
  });

  it('deve devolver o link existente sem criar nova preference', async () => {
    mockRepository.findByOrdemServicoId.mockResolvedValue(
      makePagamento({ linkPagamento: 'https://mp.test/checkout/pref-antiga' })
    );

    const link = await useCase.execute({ ordemServicoId: 'os-1', valor: 150 });

    expect(link).toBe('https://mp.test/checkout/pref-antiga');
    expect(mockGateway.criarCobranca).not.toHaveBeenCalled();
    expect(mockRepository.reservar).not.toHaveBeenCalled();
  });

  it('aprovação concorrente: quem perde a reserva espera e devolve o mesmo link, sem chamar o Mercado Pago', async () => {
    mockRepository.reservar.mockResolvedValue(false);
    mockRepository.findByOrdemServicoId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makePagamento())
      .mockResolvedValueOnce(makePagamento({ linkPagamento: 'https://mp.test/checkout/pref-1' }));

    const link = await useCase.execute({ ordemServicoId: 'os-1', valor: 150 });

    expect(link).toBe('https://mp.test/checkout/pref-1');
    expect(mockGateway.criarCobranca).not.toHaveBeenCalled();
  });

  it('aprovação concorrente: devolve 409 se a outra aprovação não terminar a tempo', async () => {
    mockRepository.reservar.mockResolvedValue(false);
    mockRepository.findByOrdemServicoId
      .mockResolvedValueOnce(null)
      .mockResolvedValue(makePagamento());

    await expect(useCase.execute({ ordemServicoId: 'os-1', valor: 150 })).rejects.toBeInstanceOf(
      ConflitoException
    );
    expect(mockGateway.criarCobranca).not.toHaveBeenCalled();
  });

  it('deve desfazer a reserva quando o Mercado Pago falha', async () => {
    mockGateway.criarCobranca.mockRejectedValue(new Error('Mercado Pago indisponível'));

    await expect(useCase.execute({ ordemServicoId: 'os-1', valor: 150 })).rejects.toThrow(
      'Mercado Pago indisponível'
    );
    const reservado = mockRepository.reservar.mock.calls[0][0];
    expect(mockRepository.remover).toHaveBeenCalledWith(reservado.getId());
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('deve substituir um pagamento pendente antigo sem link (ex.: seed) por uma cobrança nova', async () => {
    mockRepository.findByOrdemServicoId
      .mockResolvedValueOnce(makePagamento())
      .mockResolvedValueOnce(makePagamento())
      .mockResolvedValueOnce(makePagamento())
      .mockResolvedValueOnce(null);

    const link = await useCase.execute({ ordemServicoId: 'os-1', valor: 150 });

    expect(mockRepository.remover).toHaveBeenCalledWith('pag-existente');
    expect(mockRepository.reservar).toHaveBeenCalledTimes(1);
    expect(link).toBe('https://mp.test/checkout/pref-1');
  });

  it.each(['CONFIRMADO', 'RECUSADO', 'PAGO'])(
    'deve recusar com 409 quando a OS já tem pagamento %s',
    async (status) => {
      mockRepository.findByOrdemServicoId.mockResolvedValue(makePagamento({ status }));

      await expect(useCase.execute({ ordemServicoId: 'os-1', valor: 150 })).rejects.toBeInstanceOf(
        ConflitoException
      );
      expect(mockGateway.criarCobranca).not.toHaveBeenCalled();
    }
  );

  it('deve rejeitar valor não positivo antes de chamar o gateway', async () => {
    await expect(useCase.execute({ ordemServicoId: 'os-1', valor: 0 })).rejects.toThrow(
      'Valor do pagamento deve ser positivo.'
    );
    expect(mockGateway.criarCobranca).not.toHaveBeenCalled();
  });
});
