import { Logger } from '@nestjs/common';
import { ProcessadorMensagensSaga } from '../../src/modules/ordem-servico/infrastructure/messaging/processador-mensagens-saga';
import { despachantesExecucao } from '../../src/modules/ordem-servico/infrastructure/messaging/despachantes-saga';
import { AtualizarStatusEmDiagnosticoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-em-diagnostico.handler';
import { AtualizarStatusExecucaoIniciadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-execucao-iniciada.handler';
import { AtualizarStatusFinalizadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-finalizada.handler';
import { StatusTransitionService } from '../../src/modules/ordem-servico/domain/services/status-transition.service';
import {
  OrdemDeServico,
  type OSStatus,
} from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../src/modules/ordem-servico/domain/interfaces/status-history.interface';
import type { HistoricoStatus } from '../../src/modules/ordem-servico/domain/entities/historico-status.entity';
import type { IEmissorEventos } from '../../src/shared/domain/interfaces/emissor-eventos.interface';
import type { DomainEvent } from '../../src/shared/domain/events/domain-event.base';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import { EntityNotFoundException } from '../../src/shared/domain/exceptions/entity-not-found.exception';
import { EtapaDaSagaFalhou } from '../../src/modules/ordem-servico/domain/events/etapa-da-saga-falhou.event';
import {
  EXECUCAO_TOPIC,
  OS_DLT_TOPIC,
  OS_RETRY_TOPIC,
} from '../../src/shared/infrastructure/mensageria/kafka.config';

const OS_ID = 'os-1';

type Estado = { status: OSStatus; reserva: boolean; iniciadaEm: Date | null } | null;

/**
 * Consumo de `execucao.eventos.v1` de ponta a ponta no processo: envelope → processador →
 * handler real → repositório em memória. Cada gravação condicionada avalia a condição no
 * estado do momento, como o UPDATE ... WHERE no banco.
 */
function montar(inicial: Estado) {
  let estado = inicial;
  const historico: HistoricoStatus[] = [];
  const os = () => {
    if (!estado) throw new EntityNotFoundException('OrdemDeServico', OS_ID);
    return Object.assign(new OrdemDeServico(), {
      id: OS_ID,
      status: estado.status,
      reservaPecasPendente: estado.reserva,
      iniciada_em: estado.iniciadaEm,
    });
  };
  const aplicar = (data: Record<string, unknown>) => {
    if (!estado) return;
    if (data.status !== undefined) estado = { ...estado, status: data.status as OSStatus };
  };
  const osRepo = {
    findOne: jest.fn(() => Promise.resolve(os())),
    update: jest.fn((_id: string, data: Record<string, unknown>) => {
      aplicar(data);
      return Promise.resolve(os());
    }),
    atualizarSeCondicao: jest.fn(
      (_id: string, condicao: Record<string, unknown>, data: Record<string, unknown>) => {
        if (!estado) return Promise.resolve(false);
        if (condicao.status !== undefined && condicao.status !== estado.status)
          return Promise.resolve(false);
        if (
          condicao.reserva_pecas_pendente !== undefined &&
          condicao.reserva_pecas_pendente !== estado.reserva
        )
          return Promise.resolve(false);
        aplicar(data);
        return Promise.resolve(true);
      }
    ),
  } as unknown as IOrdemServicoRepository;
  const historicoRepo = {
    findByOrdemServicoId: jest.fn(() => Promise.resolve([...historico])),
    create: jest.fn((linha: HistoricoStatus) => {
      historico.push(linha);
      return Promise.resolve(linha);
    }),
  } as unknown as IStatusHistoryRepository;
  // OrdemServicoEmExecucao grava iniciada_em, como o IniciarMonitoramentoTempoHandler in-process.
  const emissor: jest.Mocked<IEmissorEventos> = {
    emitir: jest.fn((evento: DomainEvent) => {
      if (estado && evento.constructor.name === 'OrdemServicoEmExecucao')
        estado = { ...estado, iniciadaEm: new Date() };
      return Promise.resolve();
    }),
  };
  const transicao = new StatusTransitionService();
  const enviar = jest
    .fn<Promise<void>, [string, string | null, unknown]>()
    .mockResolvedValue(undefined);
  const publicador: jest.Mocked<IPublicadorIntegracao> = {
    publicar: jest.fn().mockResolvedValue(undefined),
  };

  const processador = new ProcessadorMensagensSaga({
    despachantes: despachantesExecucao({
      emDiagnostico: new AtualizarStatusEmDiagnosticoHandler(osRepo, emissor, transicao),
      execucaoIniciada: new AtualizarStatusExecucaoIniciadaHandler(osRepo, emissor, transicao),
      finalizada: new AtualizarStatusFinalizadaHandler(osRepo, historicoRepo, emissor, transicao),
    }),
    publicador,
    enviar,
  });

  const consumir = (eventType: string) =>
    processador.processar(
      EXECUCAO_TOPIC,
      OS_ID,
      JSON.stringify({
        eventId: `evt-${eventType}`,
        eventType,
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        correlationId: OS_ID,
        producer: 'execucao-producao-service',
        data: { ordemServicoId: OS_ID },
      })
    );

  return { consumir, status: () => estado?.status, historico, emissor, enviar };
}

const tópicoEnviado = (enviar: jest.Mock) => enviar.mock.calls.map(([topic]) => topic as string);

describe('Consumo de execucao.eventos.v1 com os handlers reais', () => {
  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, nivel).mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('DiagnosticoIniciado', () => {
    it('leva RECEIVED a UNDER_DIAGNOSIS; reprocessar a mesma mensagem não muda nada', async () => {
      const t = montar({ status: 'RECEIVED', reserva: false, iniciadaEm: null });

      await t.consumir('DiagnosticoIniciado');
      await t.consumir('DiagnosticoIniciado');

      expect(t.status()).toBe('UNDER_DIAGNOSIS');
      expect(t.emissor.emitir).toHaveBeenCalledTimes(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('já-passou (OS em AWAITING_APPROVAL): ack sem gravar', async () => {
      const t = montar({ status: 'AWAITING_APPROVAL', reserva: false, iniciadaEm: null });

      await t.consumir('DiagnosticoIniciado');

      expect(t.status()).toBe('AWAITING_APPROVAL');
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (OS inexistente): vai direto à DLT', async () => {
      const t = montar(null);

      await t.consumir('DiagnosticoIniciado');

      expect(tópicoEnviado(t.enviar)).toEqual([OS_DLT_TOPIC]);
    });
  });

  describe('ExecucaoIniciada', () => {
    it('leva AWAITING_APPROVAL a IN_PROGRESS; reprocessar não emite o início de novo', async () => {
      const t = montar({ status: 'AWAITING_APPROVAL', reserva: false, iniciadaEm: null });

      await t.consumir('ExecucaoIniciada');
      // Na reentrega a OS já está em IN_PROGRESS, com iniciada_em gravado: nada acontece.
      await t.consumir('ExecucaoIniciada');

      expect(t.status()).toBe('IN_PROGRESS');
      expect(t.emissor.emitir).toHaveBeenCalledTimes(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('ainda-não (OS em UNDER_DIAGNOSIS): vai ao retry topic, sem gravar', async () => {
      const t = montar({ status: 'UNDER_DIAGNOSIS', reserva: false, iniciadaEm: null });

      await t.consumir('ExecucaoIniciada');

      expect(t.status()).toBe('UNDER_DIAGNOSIS');
      expect(tópicoEnviado(t.enviar)).toEqual([OS_RETRY_TOPIC]);
    });

    it('já-passou (OS FINISHED): ack sem gravar', async () => {
      const t = montar({ status: 'FINISHED', reserva: false, iniciadaEm: new Date() });

      await t.consumir('ExecucaoIniciada');

      expect(t.status()).toBe('FINISHED');
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (OS inexistente): vai direto à DLT', async () => {
      const t = montar(null);

      await t.consumir('ExecucaoIniciada');

      expect(tópicoEnviado(t.enviar)).toEqual([OS_DLT_TOPIC]);
    });
  });

  describe('ExecucaoConcluida', () => {
    it('leva IN_PROGRESS a FINISHED; reprocessar não grava nem emite de novo', async () => {
      const t = montar({ status: 'IN_PROGRESS', reserva: false, iniciadaEm: new Date() });

      await t.consumir('ExecucaoConcluida');
      await t.consumir('ExecucaoConcluida');

      expect(t.status()).toBe('FINISHED');
      expect(t.emissor.emitir).toHaveBeenCalledTimes(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('ainda-não (OS em AWAITING_APPROVAL): vai ao retry topic', async () => {
      const t = montar({ status: 'AWAITING_APPROVAL', reserva: false, iniciadaEm: null });

      await t.consumir('ExecucaoConcluida');

      expect(tópicoEnviado(t.enviar)).toEqual([OS_RETRY_TOPIC]);
    });

    it('irrecuperável de negócio (OS em AWAITING_PARTS): sinaliza EtapaDaSagaFalhou uma vez, sem retry', async () => {
      const t = montar({ status: 'AWAITING_PARTS', reserva: true, iniciadaEm: new Date() });

      await t.consumir('ExecucaoConcluida');
      await t.consumir('ExecucaoConcluida');

      const falhas = t.emissor.emitir.mock.calls.filter(
        ([evento]) => evento instanceof EtapaDaSagaFalhou
      );
      expect(falhas).toHaveLength(1);
      expect(t.historico).toHaveLength(1);
      expect(t.status()).toBe('AWAITING_PARTS');
      expect(t.enviar).not.toHaveBeenCalled();
    });
  });
});
