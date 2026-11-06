import { Logger } from '@nestjs/common';
import { DetectarOsParadaUseCase } from '../../src/modules/ordem-servico/application/use-cases/detectar-os-parada.use-case';
import { prazoDetectorMinutos } from '../../src/modules/ordem-servico/detector-os-parada.module';
import { EtapaDaSagaFalhou } from '../../src/modules/ordem-servico/domain/events/etapa-da-saga-falhou.event';
import { OrdemDeServico } from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../src/modules/ordem-servico/domain/interfaces/status-history.interface';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import type { IOSStatusTransitionLogger } from '../../src/modules/ordem-servico/application/logging/log-os-status-transition';

const AGORA = new Date('2026-11-03T12:00:00.000Z');
const os = (id: string) => Object.assign(new OrdemDeServico(), { id, status: 'AWAITING_APPROVAL' });

describe('DetectarOsParadaUseCase', () => {
  let osRepo: jest.Mocked<
    Pick<IOrdemServicoRepository, 'findParadasAguardandoAprovacao' | 'atualizarSeCondicao'>
  >;
  let historicoRepo: jest.Mocked<IStatusHistoryRepository>;
  let publicador: jest.Mocked<IPublicadorIntegracao>;
  let transitionLogger: jest.Mocked<IOSStatusTransitionLogger>;
  const detector = (prazoMinutos = 30) =>
    new DetectarOsParadaUseCase(
      osRepo as unknown as IOrdemServicoRepository,
      historicoRepo,
      publicador,
      transitionLogger,
      prazoMinutos,
      () => AGORA
    );

  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, nivel).mockImplementation();
    osRepo = {
      findParadasAguardandoAprovacao: jest.fn().mockResolvedValue([]),
      atualizarSeCondicao: jest.fn().mockResolvedValue(true),
    };
    historicoRepo = { create: jest.fn(), findByOrdemServicoId: jest.fn() };
    publicador = { publicar: jest.fn().mockResolvedValue(undefined) };
    transitionLogger = { log: jest.fn() };
  });
  afterEach(() => jest.restoreAllMocks());

  it('busca OS sem atualização desde agora menos o prazo', async () => {
    await detector(30).executar();

    expect(osRepo.findParadasAguardandoAprovacao).toHaveBeenCalledWith(
      new Date('2026-11-03T11:30:00.000Z')
    );
  });

  it('publica EtapaDaSagaFalhou (aprovacao-pagamento, sem evento original) e fecha a OS', async () => {
    const log = transitionLogger.log;
    osRepo.findParadasAguardandoAprovacao.mockResolvedValue([os('os-1')]);

    const resultado = await detector().executar();

    const falha = publicador.publicar.mock.calls[0][0] as EtapaDaSagaFalhou;
    expect(falha).toBeInstanceOf(EtapaDaSagaFalhou);
    expect(falha).toMatchObject({
      servicoOrigem: 'os-service',
      eventTypeOriginal: null,
      ordemServicoId: 'os-1',
      etapa: 'aprovacao-pagamento',
    });
    expect(osRepo.atualizarSeCondicao).toHaveBeenCalledWith(
      'os-1',
      { status: 'AWAITING_APPROVAL', pago_em: null },
      { status: 'CLOSED_WITHOUT_EXECUTION' }
    );
    expect(historicoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ordemServicoId: 'os-1',
        statusAnterior: 'AWAITING_APPROVAL',
        statusNovo: 'CLOSED_WITHOUT_EXECUTION',
      })
    );
    expect(resultado).toEqual({ encontradas: 1, encerradas: 1, falhas: 0 });
    expect(log).toHaveBeenCalledWith({
      logType: 'os.status.transition',
      previousStatus: 'AWAITING_APPROVAL',
      newStatus: 'CLOSED_WITHOUT_EXECUTION',
    });
  });

  it('publica antes de fechar: o evento sai mesmo se o fechamento falhar depois', async () => {
    osRepo.findParadasAguardandoAprovacao.mockResolvedValue([os('os-1')]);
    osRepo.atualizarSeCondicao.mockRejectedValue(new Error('banco indisponível'));

    const resultado = await detector().executar();

    expect(publicador.publicar).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ encontradas: 1, encerradas: 0, falhas: 1 });
  });

  it('se a OS foi paga entre a busca e o fechamento, não fecha nem registra', async () => {
    const log = transitionLogger.log;
    osRepo.findParadasAguardandoAprovacao.mockResolvedValue([os('os-1')]);
    osRepo.atualizarSeCondicao.mockResolvedValue(false);

    const resultado = await detector().executar();

    expect(historicoRepo.create).not.toHaveBeenCalled();
    expect(resultado).toEqual({ encontradas: 1, encerradas: 0, falhas: 0 });
    expect(log).not.toHaveBeenCalledWith(
      expect.objectContaining({ logType: 'os.status.transition' })
    );
  });

  it('não registra transição quando a atualização condicional falha', async () => {
    const log = transitionLogger.log;
    osRepo.findParadasAguardandoAprovacao.mockResolvedValue([os('os-1')]);
    osRepo.atualizarSeCondicao.mockRejectedValue(new Error('database failure with private data'));

    await detector().executar();

    expect(log).not.toHaveBeenCalledWith(
      expect.objectContaining({ logType: 'os.status.transition' })
    );
  });

  it('mantém publicação antes do CAS e grava histórico após falha síncrona do logger', async () => {
    const order: string[] = [];
    osRepo.findParadasAguardandoAprovacao.mockResolvedValue([os('os-1')]);
    publicador.publicar.mockImplementation(() => {
      order.push('publish');
      return Promise.resolve();
    });
    osRepo.atualizarSeCondicao.mockImplementation(() => {
      order.push('cas');
      return Promise.resolve(true);
    });
    historicoRepo.create.mockImplementation((historico) => {
      order.push('history');
      return Promise.resolve(historico);
    });
    transitionLogger.log.mockImplementationOnce(() => {
      order.push('log');
      throw new Error('logger unavailable');
    });

    const resultado = await detector().executar();

    expect(resultado).toEqual({ encontradas: 1, encerradas: 1, falhas: 0 });
    expect(order).toEqual(['publish', 'cas', 'log', 'history']);
  });

  it('a falha de publicação de uma OS não impede as outras e não fecha a OS', async () => {
    osRepo.findParadasAguardandoAprovacao.mockResolvedValue([os('os-1'), os('os-2')]);
    publicador.publicar.mockRejectedValueOnce(new Error('broker indisponível'));

    const resultado = await detector().executar();

    expect(osRepo.atualizarSeCondicao).toHaveBeenCalledTimes(1);
    expect(osRepo.atualizarSeCondicao).toHaveBeenCalledWith(
      'os-2',
      expect.anything(),
      expect.anything()
    );
    expect(resultado).toEqual({ encontradas: 2, encerradas: 1, falhas: 1 });
  });

  it('sem OS parada não publica nada', async () => {
    const resultado = await detector().executar();

    expect(publicador.publicar).not.toHaveBeenCalled();
    expect(resultado).toEqual({ encontradas: 0, encerradas: 0, falhas: 0 });
  });
});

describe('prazoDetectorMinutos', () => {
  it('usa 48 h por padrão', () => {
    expect(prazoDetectorMinutos({})).toBe(2880);
    expect(prazoDetectorMinutos({ DETECTOR_OS_PARADA_PRAZO_MINUTOS: ' ' })).toBe(2880);
  });

  it('lê o prazo em minutos do ambiente', () => {
    expect(prazoDetectorMinutos({ DETECTOR_OS_PARADA_PRAZO_MINUTOS: '5' })).toBe(5);
  });

  it.each(['0', '-1', '1.5', 'abc'])('rejeita prazo inválido (%s)', (valor) => {
    expect(() => prazoDetectorMinutos({ DETECTOR_OS_PARADA_PRAZO_MINUTOS: valor })).toThrow(
      'DETECTOR_OS_PARADA_PRAZO_MINUTOS inválido'
    );
  });
});
