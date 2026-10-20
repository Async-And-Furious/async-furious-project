import { ProcessarNotificacaoPagamentoUseCase } from '../../../src/modules/financeiro/application/use-cases/processar-notificacao-pagamento.use-case';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';
import { PagamentoConfirmadoEvent } from '../../../src/modules/financeiro/domain/events/pagamento-confirmado.event';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
  PagamentoExterno,
} from '../../../src/modules/financeiro/domain/interfaces/pagamento.interface';
import type { IEmissorEventos } from '../../../src/shared/domain/interfaces/emissor-eventos.interface';

const makePagamento = (status = 'AGUARDANDO_PAGAMENTO') =>
  Pagamento.reconstituir({
    id: 'pag-1',
    ordemServicoId: 'os-1',
    valor: 369.9,
    status,
    preferenceId: 'pref-1',
    linkPagamento: 'https://mp.test/checkout/pref-1',
  });

const makeExterno = (overrides: Partial<PagamentoExterno> = {}): PagamentoExterno => ({
  id: '123',
  status: 'approved',
  referenciaExterna: 'os-1',
  valor: 369.9,
  ...overrides,
});

describe('ProcessarNotificacaoPagamentoUseCase', () => {
  let mockRepository: jest.Mocked<IPagamentoRepository>;
  let mockGateway: jest.Mocked<IGatewayPagamento>;
  let mockEmissor: jest.Mocked<IEmissorEventos>;
  let useCase: ProcessarNotificacaoPagamentoUseCase;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findCobrancaByOrdemServicoId: jest.fn().mockResolvedValue(makePagamento()),
    };
    mockGateway = {
      criarCobranca: jest.fn(),
      consultarPagamento: jest.fn().mockResolvedValue(makeExterno()),
    };
    mockEmissor = { emitir: jest.fn().mockResolvedValue(undefined) };
    useCase = new ProcessarNotificacaoPagamentoUseCase(mockRepository, mockGateway, mockEmissor);
  });

  it('deve confirmar o pagamento aprovado e emitir PagamentoConfirmado', async () => {
    const resultado = await useCase.execute('123');

    expect(resultado).toBe('CONFIRMADO');
    expect(mockGateway.consultarPagamento).toHaveBeenCalledWith('123');
    expect(mockRepository.findCobrancaByOrdemServicoId).toHaveBeenCalledWith('os-1');
    expect(mockRepository.save.mock.calls[0][0].getStatus()).toBe('CONFIRMADO');
    expect(mockEmissor.emitir).toHaveBeenCalledWith(expect.any(PagamentoConfirmadoEvent));
    expect(mockEmissor.emitir.mock.calls[0][0]).toMatchObject({
      pagamentoId: 'pag-1',
      ordemServicoId: 'os-1',
    });
  });

  it('deve ser idempotente quando o pagamento já foi confirmado', async () => {
    mockRepository.findCobrancaByOrdemServicoId.mockResolvedValue(makePagamento('CONFIRMADO'));

    await expect(useCase.execute('123')).resolves.toBe('JA_CONFIRMADO');
    expect(mockRepository.save).not.toHaveBeenCalled();
    expect(mockEmissor.emitir).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'pending', 'in_process', 'cancelled'])(
    'deve ignorar status %s sem alterar o pagamento',
    async (status) => {
      mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ status }));

      await expect(useCase.execute('123')).resolves.toBe('STATUS_IGNORADO');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEmissor.emitir).not.toHaveBeenCalled();
    }
  );

  it('não deve confirmar quando o valor pago diverge da cobrança', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ valor: 1 }));

    await expect(useCase.execute('123')).resolves.toBe('VALOR_DIVERGENTE');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('deve ignorar pagamento inexistente no Mercado Pago (ex.: simulador do painel)', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(null);

    await expect(useCase.execute('123')).resolves.toBe('PAGAMENTO_NAO_ENCONTRADO');
    expect(mockRepository.findCobrancaByOrdemServicoId).not.toHaveBeenCalled();
  });

  it('deve ignorar pagamento sem cobrança correspondente', async () => {
    mockRepository.findCobrancaByOrdemServicoId.mockResolvedValue(null);

    await expect(useCase.execute('123')).resolves.toBe('COBRANCA_NAO_ENCONTRADA');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('deve ignorar pagamento sem external_reference', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ referenciaExterna: null }));

    await expect(useCase.execute('123')).resolves.toBe('COBRANCA_NAO_ENCONTRADA');
    expect(mockRepository.findCobrancaByOrdemServicoId).not.toHaveBeenCalled();
  });

  it('deve propagar falha da reconsulta para o Mercado Pago reenviar', async () => {
    mockGateway.consultarPagamento.mockRejectedValue(new Error('timeout'));

    await expect(useCase.execute('123')).rejects.toThrow('timeout');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
