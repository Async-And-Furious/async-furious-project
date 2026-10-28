import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IEmissorEventos } from '../../src/shared/domain/interfaces/emissor-eventos.interface';
import { AtualizarStatusEmDiagnosticoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-em-diagnostico.handler';
import { NotificarClienteDiagnosticoHandler } from '../../src/modules/ordem-servico/application/event-handlers/notificar-cliente-diagnostico.handler';
import { AtualizarStatusExecucaoIniciadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-execucao-iniciada.handler';
import { AtualizarStatusEmExecucaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-em-execucao.handler';
import { AtualizarStatusAguardandoPecasHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-aguardando-pecas.handler';
import { IniciarMonitoramentoTempoHandler } from '../../src/modules/ordem-servico/application/event-handlers/iniciar-monitoramento-tempo.handler';
import { AtualizarStatusFinalizadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-finalizada.handler';
import { FinalizarMonitoramentoTempoHandler } from '../../src/modules/ordem-servico/application/event-handlers/finalizar-monitoramento-tempo.handler';
import { NotificarClienteConclusaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/notificar-cliente-conclusao.handler';
import type { INotificacaoClienteGateway } from '../../src/modules/ordem-servico/application/ports/notificacao-cliente.gateway';
import type {
  IOrdemServicoRepository,
  OrdemServicoUpdateData,
} from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../src/modules/ordem-servico/domain/interfaces/status-history.interface';
import {
  OrdemDeServico,
  type OSStatus,
} from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import { DiagnosticoIniciado } from '../../src/modules/ordem-servico/domain/events/diagnostico-iniciado.event';
import { ExecucaoIniciada } from '../../src/modules/ordem-servico/domain/events/execucao-iniciada.event';
import { ExecucaoConcluida } from '../../src/modules/ordem-servico/domain/events/execucao-concluida.event';
import { PecasIndisponiveis } from '../../src/modules/pecas-insumos/domain/events/pecas-indisponiveis.event';
import { PecasReservadas } from '../../src/modules/pecas-insumos/domain/events/pecas-reservadas.event';
import { EtapaDaSagaFalhou } from '../../src/modules/ordem-servico/domain/events/etapa-da-saga-falhou.event';
import { HistoricoStatus } from '../../src/modules/ordem-servico/domain/entities/historico-status.entity';
import { StatusTransitionService } from '../../src/modules/ordem-servico/domain/services/status-transition.service';

/**
 * Exercita a fiação real de @OnEvent: os eventos de integração do Execução e Produção
 * (DiagnosticoIniciado, ExecucaoIniciada, ExecucaoConcluida) chegam pelo EmissorEventos
 * e disparam os handlers do OS Service, inclusive os efeitos encadeados que não mudaram
 * (notificações e marcos de tempo).
 */
describe('Eventos do Execução e Produção → OS Service (fiação @OnEvent)', () => {
  let moduleRef: TestingModule;
  let emissor: IEmissorEventos;
  let osStore: OrdemDeServico;
  let updates: OrdemServicoUpdateData[];
  let notificacoes: string[];
  let historico: jest.Mocked<IStatusHistoryRepository>;
  const transicao = new StatusTransitionService();

  const novaOs = (status: OSStatus): OrdemDeServico =>
    Object.assign(new OrdemDeServico(), {
      id: 'os-1',
      veiculoId: 'veh-1',
      clienteId: 'cli-1',
      status,
      descricao: null,
      iniciada_em: null,
      finalizada_em: null,
      entregue_em: null,
      reservaPecasPendente: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

  const osRepo: IOrdemServicoRepository = {
    findOne: jest.fn(() => Promise.resolve(Object.assign(new OrdemDeServico(), osStore))),
    update: jest.fn((_id: string, data: OrdemServicoUpdateData) => {
      updates.push(data);
      if (data.status) osStore.status = data.status;
      if (data.iniciada_em !== undefined) osStore.iniciada_em = data.iniciada_em;
      if (data.finalizada_em !== undefined) osStore.finalizada_em = data.finalizada_em;
      if (data.reserva_pecas_pendente !== undefined) {
        osStore.reservaPecasPendente = data.reserva_pecas_pendente;
      }
      return Promise.resolve(Object.assign(new OrdemDeServico(), osStore));
    }),
  } as unknown as IOrdemServicoRepository;

  const gateway: INotificacaoClienteGateway = {
    notificar: jest.fn(({ mensagem }) => {
      notificacoes.push(mensagem);
      return Promise.resolve();
    }),
  };

  beforeEach(async () => {
    updates = [];
    notificacoes = [];
    osStore = novaOs('RECEIVED');
    historico = {
      create: jest.fn(),
      findByOrdemServicoId: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<IStatusHistoryRepository>;

    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        EmissorEventos,
        {
          provide: AtualizarStatusEmDiagnosticoHandler,
          useFactory: (e: EmissorEventos) =>
            new AtualizarStatusEmDiagnosticoHandler(osRepo, e, transicao),
          inject: [EmissorEventos],
        },
        {
          provide: NotificarClienteDiagnosticoHandler,
          useFactory: () => new NotificarClienteDiagnosticoHandler(gateway),
        },
        {
          provide: AtualizarStatusExecucaoIniciadaHandler,
          useFactory: (e: EmissorEventos) =>
            new AtualizarStatusExecucaoIniciadaHandler(osRepo, e, transicao),
          inject: [EmissorEventos],
        },
        {
          provide: AtualizarStatusEmExecucaoHandler,
          useFactory: (e: EmissorEventos) =>
            new AtualizarStatusEmExecucaoHandler(osRepo, e, transicao),
          inject: [EmissorEventos],
        },
        {
          provide: AtualizarStatusAguardandoPecasHandler,
          useFactory: (e: EmissorEventos) =>
            new AtualizarStatusAguardandoPecasHandler(osRepo, e, transicao),
          inject: [EmissorEventos],
        },
        {
          provide: IniciarMonitoramentoTempoHandler,
          useFactory: () => new IniciarMonitoramentoTempoHandler(osRepo),
        },
        {
          provide: AtualizarStatusFinalizadaHandler,
          useFactory: (e: EmissorEventos) =>
            new AtualizarStatusFinalizadaHandler(osRepo, historico, e, transicao),
          inject: [EmissorEventos],
        },
        {
          provide: FinalizarMonitoramentoTempoHandler,
          useFactory: () => new FinalizarMonitoramentoTempoHandler(osRepo),
        },
        {
          provide: NotificarClienteConclusaoHandler,
          useFactory: (e: EmissorEventos) => new NotificarClienteConclusaoHandler(gateway, e),
          inject: [EmissorEventos],
        },
      ],
    }).compile();
    await moduleRef.init();
    emissor = moduleRef.get(EmissorEventos);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.clearAllMocks();
  });

  it('DiagnosticoIniciado grava UNDER_DIAGNOSIS e a notificação de diagnóstico ao cliente dispara', async () => {
    await emissor.emitir(new DiagnosticoIniciado('os-1'));

    expect(osStore.status).toBe('UNDER_DIAGNOSIS');
    expect(notificacoes).toEqual(['Seu veículo está em diagnóstico.']);
  });

  it('DiagnosticoIniciado repetido é ignorado (sem nova gravação nem nova notificação)', async () => {
    await emissor.emitir(new DiagnosticoIniciado('os-1'));
    await emissor.emitir(new DiagnosticoIniciado('os-1'));

    expect(updates).toHaveLength(1);
    expect(notificacoes).toHaveLength(1);
  });

  it('ExecucaoIniciada leva AWAITING_APPROVAL a IN_PROGRESS e marca iniciada_em', async () => {
    osStore = novaOs('AWAITING_APPROVAL');

    await emissor.emitir(new ExecucaoIniciada('os-1'));

    expect(osStore.status).toBe('IN_PROGRESS');
    expect(osStore.iniciada_em).toBeInstanceOf(Date);
  });

  it('ExecucaoIniciada com a OS CLOSED_WITHOUT_EXECUTION é ignorada', async () => {
    osStore = novaOs('CLOSED_WITHOUT_EXECUTION');

    await emissor.emitir(new ExecucaoIniciada('os-1'));

    expect(updates).toEqual([]);
  });

  it('reserva pendente: PecasIndisponiveis só marca, ExecucaoIniciada faz IN_PROGRESS e AWAITING_PARTS, PecasReservadas retoma IN_PROGRESS', async () => {
    osStore = novaOs('AWAITING_APPROVAL');

    await emissor.emitir(new PecasIndisponiveis('os-1', ['peca-1']));
    expect(osStore.status).toBe('AWAITING_APPROVAL');
    expect(osStore.reservaPecasPendente).toBe(true);

    await emissor.emitir(new ExecucaoIniciada('os-1'));
    expect(updates.filter((u) => u.status).map((u) => u.status)).toEqual([
      'IN_PROGRESS',
      'AWAITING_PARTS',
    ]);
    expect(osStore.status).toBe('AWAITING_PARTS');

    await emissor.emitir(new PecasReservadas('os-1', [{ id_peca: 'peca-1', quantidade: 1 }]));
    expect(osStore.status).toBe('IN_PROGRESS');
    expect(osStore.reservaPecasPendente).toBe(false);
  });

  it('PecasReservadas antes de ExecucaoIniciada não muda o status (a reserva não leva mais a IN_PROGRESS)', async () => {
    osStore = novaOs('AWAITING_APPROVAL');

    await emissor.emitir(new PecasReservadas('os-1', [{ id_peca: 'peca-1', quantidade: 1 }]));

    expect(osStore.status).toBe('AWAITING_APPROVAL');
    expect(updates).toEqual([]);
  });

  it('ExecucaoConcluida grava FINISHED, finaliza o monitoramento de tempo e notifica a conclusão', async () => {
    osStore = novaOs('IN_PROGRESS');
    osStore.iniciada_em = new Date(Date.now() - 60 * 60000);

    await emissor.emitir(new ExecucaoConcluida('os-1'));

    expect(osStore.status).toBe('FINISHED');
    expect(osStore.finalizada_em).toBeInstanceOf(Date);
    expect(notificacoes).toEqual(['Seu veículo foi finalizado e está pronto para retirada.']);
  });

  // In-process, o EventEmitterModule (suppressErrors padrão) registra a FalhaRetentavelException
  // em log e não propaga: o que se garante aqui é a ausência de gravação. A retentativa é do
  // consumidor Kafka (ADR-0018), e a unidade de cada handler está coberta em event-handlers.spec.
  it('ExecucaoIniciada antes da aprovação (OS em UNDER_DIAGNOSIS) não grava nada', async () => {
    osStore = novaOs('UNDER_DIAGNOSIS');

    await emissor.emitir(new ExecucaoIniciada('os-1'));

    expect(updates).toEqual([]);
    expect(osStore.status).toBe('UNDER_DIAGNOSIS');
  });

  it('ExecucaoConcluida antes do reparo (OS em AWAITING_APPROVAL) não grava nem sinaliza falha', async () => {
    osStore = novaOs('AWAITING_APPROVAL');

    await emissor.emitir(new ExecucaoConcluida('os-1'));

    expect(updates).toEqual([]);
    expect(historico.create).not.toHaveBeenCalled();
  });

  it('PecasIndisponiveis tardio (OS já em IN_PROGRESS) leva a AWAITING_PARTS', async () => {
    osStore = novaOs('IN_PROGRESS');

    await emissor.emitir(new PecasIndisponiveis('os-1', ['peca-1']));

    expect(osStore.status).toBe('AWAITING_PARTS');
  });

  it('ExecucaoConcluida com a OS em AWAITING_PARTS, reentregue: sinaliza a falha de reparo uma só vez', async () => {
    osStore = novaOs('AWAITING_PARTS');
    const linhas: HistoricoStatus[] = [];
    historico.create.mockImplementation((linha) => {
      linhas.push(linha);
      return Promise.resolve(linha);
    });
    historico.findByOrdemServicoId.mockImplementation(() => Promise.resolve(linhas));
    const emitir = jest.spyOn(emissor, 'emitir');

    await emissor.emitir(new ExecucaoConcluida('os-1'));
    await emissor.emitir(new ExecucaoConcluida('os-1'));

    expect(osStore.status).toBe('AWAITING_PARTS');
    expect(linhas).toHaveLength(1);
    expect(
      emitir.mock.calls.filter(([evento]) => evento instanceof EtapaDaSagaFalhou)
    ).toHaveLength(1);
  });

  it('fluxo completo do mecânico: diagnóstico → execução → conclusão', async () => {
    await emissor.emitir(new DiagnosticoIniciado('os-1'));
    expect(osStore.status).toBe('UNDER_DIAGNOSIS');

    osStore.status = 'AWAITING_APPROVAL';
    await emissor.emitir(new ExecucaoIniciada('os-1'));
    expect(osStore.status).toBe('IN_PROGRESS');

    await emissor.emitir(new ExecucaoConcluida('os-1'));
    expect(osStore.status).toBe('FINISHED');
    expect(osStore.iniciada_em).toBeInstanceOf(Date);
    expect(osStore.finalizada_em).toBeInstanceOf(Date);
  });
});
