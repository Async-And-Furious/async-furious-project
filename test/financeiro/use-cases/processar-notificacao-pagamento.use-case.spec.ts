import { ProcessarNotificacaoPagamentoUseCase } from '../../../src/modules/financeiro/application/use-cases/processar-notificacao-pagamento.use-case';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';
import { PagamentoConfirmadoEvent } from '../../../src/modules/financeiro/domain/events/pagamento-confirmado.event';
import { PagamentoRecusadoEvent } from '../../../src/modules/financeiro/domain/events/pagamento-recusado.event';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
  PagamentoExterno,
} from '../../../src/modules/financeiro/domain/interfaces/pagamento.interface';
import type { IEmissorEventos } from '../../../src/shared/domain/interfaces/emissor-eventos.interface';

const makePagamento = (status = 'AGUARDANDO_PAGAMENTO', pagamentoExternoId: string | null = null) =>
  Pagamento.reconstituir({
    id: 'pag-1',
    ordemServicoId: 'os-1',
    valor: 369.9,
    status,
    preferenceId: 'pref-1',
    linkPagamento: 'https://mp.test/checkout/pref-1',
    pagamentoExternoId,
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
      save: jest.fn(),
      findById: jest.fn(),
      findByOrdemServicoId: jest.fn().mockResolvedValue(makePagamento()),
      reservar: jest.fn(),
      remover: jest.fn(),
      saveComNotificacao: jest.fn().mockResolvedValue(true),
    };
    mockGateway = {
      criarCobranca: jest.fn(),
      consultarPagamento: jest.fn().mockResolvedValue(makeExterno()),
    };
    mockEmissor = { emitir: jest.fn().mockResolvedValue(undefined) };
    useCase = new ProcessarNotificacaoPagamentoUseCase(mockRepository, mockGateway, mockEmissor);
  });

  it('deve confirmar o pagamento aprovado, gravando a notificação, e emitir PagamentoConfirmado', async () => {
    const resultado = await useCase.execute('123');

    expect(resultado).toBe('CONFIRMADO');
    expect(mockGateway.consultarPagamento).toHaveBeenCalledWith('123');
    expect(mockRepository.findByOrdemServicoId).toHaveBeenCalledWith('os-1');
    const [salvo, notificacao] = mockRepository.saveComNotificacao.mock.calls[0];
    expect(salvo.getStatus()).toBe('CONFIRMADO');
    expect(salvo.getPagamentoExternoId()).toBe('123');
    expect(notificacao).toEqual({ providerEventId: '123', tipo: 'payment.approved' });
    expect(mockEmissor.emitir).toHaveBeenCalledWith(expect.any(PagamentoConfirmadoEvent));
    expect(mockEmissor.emitir.mock.calls[0][0]).toMatchObject({
      pagamentoId: 'pag-1',
      ordemServicoId: 'os-1',
    });
  });

  it.each(['rejected', 'cancelled'])(
    'deve recusar (terminal) o pagamento %s e emitir PagamentoRecusado',
    async (status) => {
      mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ status }));

      await expect(useCase.execute('123')).resolves.toBe('RECUSADO');
      const [salvo, notificacao] = mockRepository.saveComNotificacao.mock.calls[0];
      expect(salvo.getStatus()).toBe('RECUSADO');
      expect(notificacao).toEqual({ providerEventId: '123', tipo: `payment.${status}` });
      expect(mockEmissor.emitir).toHaveBeenCalledWith(expect.any(PagamentoRecusadoEvent));
    }
  );

  it.each(['pending', 'in_process', 'authorized'])(
    'deve ignorar status %s sem alterar o pagamento nem emitir evento',
    async (status) => {
      mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ status }));

      await expect(useCase.execute('123')).resolves.toBe('STATUS_IGNORADO');
      expect(mockRepository.saveComNotificacao).not.toHaveBeenCalled();
      expect(mockEmissor.emitir).not.toHaveBeenCalled();
    }
  );

  it('reentrega: pagamento já confirmado com o mesmo id não muda nada', async () => {
    mockRepository.findByOrdemServicoId.mockResolvedValue(makePagamento('CONFIRMADO', '123'));

    await expect(useCase.execute('123')).resolves.toBe('JA_PROCESSADO');
    expect(mockRepository.saveComNotificacao).not.toHaveBeenCalled();
    expect(mockEmissor.emitir).not.toHaveBeenCalled();
  });

  it('reentrega para pagamento confirmado antes de o id do Mercado Pago ser guardado', async () => {
    mockRepository.findByOrdemServicoId.mockResolvedValue(makePagamento('CONFIRMADO', null));

    await expect(useCase.execute('123')).resolves.toBe('JA_PROCESSADO');
    expect(mockRepository.saveComNotificacao).not.toHaveBeenCalled();
  });

  it('pagamento já confirmado recebendo outro pagamento aprovado é sinalizado (exige estorno)', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ id: '456' }));
    mockRepository.findByOrdemServicoId.mockResolvedValue(makePagamento('CONFIRMADO', '123'));

    await expect(useCase.execute('456')).resolves.toBe('APROVADO_APOS_ENCERRAMENTO');
  });

  it('reentrega concorrente: notificação já gravada (unique) não emite evento de novo', async () => {
    mockRepository.saveComNotificacao.mockResolvedValue(false);

    await expect(useCase.execute('123')).resolves.toBe('JA_PROCESSADO');
    expect(mockEmissor.emitir).not.toHaveBeenCalled();
  });

  it('reentrega de recusa já processada não muda nada', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ status: 'rejected' }));
    mockRepository.findByOrdemServicoId.mockResolvedValue(makePagamento('RECUSADO', '123'));

    await expect(useCase.execute('123')).resolves.toBe('JA_PROCESSADO');
    expect(mockRepository.saveComNotificacao).not.toHaveBeenCalled();
  });

  it('aprovado depois de a cobrança ter sido recusada: não confirma (exige estorno)', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ id: '456' }));
    mockRepository.findByOrdemServicoId.mockResolvedValue(makePagamento('RECUSADO', '123'));

    await expect(useCase.execute('456')).resolves.toBe('APROVADO_APOS_ENCERRAMENTO');
    expect(mockRepository.saveComNotificacao).not.toHaveBeenCalled();
    expect(mockEmissor.emitir).not.toHaveBeenCalled();
  });

  it('não deve confirmar quando o valor pago diverge da cobrança', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ valor: 1 }));

    await expect(useCase.execute('123')).resolves.toBe('VALOR_DIVERGENTE');
    expect(mockRepository.saveComNotificacao).not.toHaveBeenCalled();
  });

  it('deve ignorar pagamento inexistente no Mercado Pago (ex.: simulador do painel)', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(null);

    await expect(useCase.execute('123')).resolves.toBe('PAGAMENTO_NAO_ENCONTRADO');
    expect(mockRepository.findByOrdemServicoId).not.toHaveBeenCalled();
  });

  it('deve ignorar pagamento sem cobrança correspondente', async () => {
    mockRepository.findByOrdemServicoId.mockResolvedValue(null);

    await expect(useCase.execute('123')).resolves.toBe('COBRANCA_NAO_ENCONTRADA');
  });

  it('deve ignorar pagamento sem external_reference', async () => {
    mockGateway.consultarPagamento.mockResolvedValue(makeExterno({ referenciaExterna: null }));

    await expect(useCase.execute('123')).resolves.toBe('COBRANCA_NAO_ENCONTRADA');
    expect(mockRepository.findByOrdemServicoId).not.toHaveBeenCalled();
  });

  it('deve propagar falha da reconsulta para o Mercado Pago reenviar', async () => {
    mockGateway.consultarPagamento.mockRejectedValue(new Error('timeout'));

    await expect(useCase.execute('123')).rejects.toThrow('timeout');
    expect(mockRepository.saveComNotificacao).not.toHaveBeenCalled();
  });

  it('não deve emitir evento quando a transação falha', async () => {
    mockRepository.saveComNotificacao.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute('123')).rejects.toThrow('db down');
    expect(mockEmissor.emitir).not.toHaveBeenCalled();
  });
});
