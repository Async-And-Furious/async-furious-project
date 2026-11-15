import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import pino from 'pino';
import { Writable } from 'node:stream';
import type { Provider, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import {
  PUBLICADOR_INTEGRACAO,
  type IPublicadorIntegracao,
} from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import { EMISSOR_EVENTOS } from '../../src/shared/domain/interfaces/emissor-eventos.interface';
import { OrdemServicoModule } from '../../src/modules/ordem-servico/ordem-servico.module';
import { DetectorOsParadaModule } from '../../src/modules/ordem-servico/detector-os-parada.module';
import { OS_STATUS_TRANSITION_LOGGER } from '../../src/modules/ordem-servico/application/logging/log-os-status-transition';
import { OsStatusTransitionPinoLogger } from '../../src/modules/ordem-servico/infrastructure/logging/os-status-transition-pino-logger';
import { OrdemServicoRepository } from '../../src/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository';
import { StatusHistoryRepository } from '../../src/modules/ordem-servico/infrastructure/repositories/status-history.repository';
import { AtualizarStatusEncerradaSemExecucaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-encerrada-sem-execucao.handler';
import { AtualizarStatusFinalizadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-finalizada.handler';
import { DetectarOsParadaUseCase } from '../../src/modules/ordem-servico/application/use-cases/detectar-os-parada.use-case';
import { UpdateServiceOrderStatusUseCase } from '../../src/modules/ordem-servico/application/use-cases/update-service-order-status.use-case';
import { SERVICE_NAME } from '../../src/shared/infrastructure/logging/pino-logger.config';
import { OrcamentoRecusado } from '../../src/modules/ordem-servico/domain/events/orcamento-recusado.event';
import { ExecucaoConcluida } from '../../src/modules/ordem-servico/domain/events/execucao-concluida.event';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../src/modules/ordem-servico/domain/interfaces/status-history.interface';
import { RESERVA_ESTOQUE_PORT } from '../../src/shared/domain/interfaces/reserva-estoque.port';

function providersFrom(module: Type<unknown>): Provider[] {
  return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) as Provider[];
}

function capturedTransitionLogs(): { lines: string[] } {
  return { lines: [] };
}

function withTransitionLogger(providers: Provider[], output: { lines: string[] }): Provider[] {
  return [
    ...providers.filter(
      (provider) =>
        typeof provider === 'function' || provider.provide !== OS_STATUS_TRANSITION_LOGGER
    ),
    transitionLoggerProvider(output),
  ];
}

function transitionLoggerProvider(output: { lines: string[] }): Provider {
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output.lines.push(String(chunk));
      callback();
    },
  });
  return {
    provide: OS_STATUS_TRANSITION_LOGGER,
    useFactory: () =>
      new OsStatusTransitionPinoLogger(pino({ base: { service: SERVICE_NAME } }, destination)),
  };
}

function expectTransitionJson(lines: string[], previousStatus: string, newStatus: string): void {
  const record = lines
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    })
    .find((line) => line?.logType === 'os.status.transition');
  expect(record).toMatchObject({
    logType: 'os.status.transition',
    previousStatus,
    newStatus,
    service: SERVICE_NAME,
  });
  expect(record).not.toHaveProperty('ordemServicoId');
  expect(record).not.toHaveProperty('eventId');
  expect(record).not.toHaveProperty('correlationId');
}

const reservaEstoque = { releaseByOrdemId: jest.fn().mockResolvedValue(0) };

describe('status transition logging Nest provider wiring', () => {
  it('uses effective API module providers for an HTTP-callable refusal transition', async () => {
    let status = 'AWAITING_APPROVAL';
    const repo = {
      findOne: jest.fn(() => Promise.resolve({ status })),
      atualizarSeCondicao: jest.fn((_id, condition, update) => {
        if (status !== condition.status) return Promise.resolve(false);
        status = update.status;
        return Promise.resolve(true);
      }),
    } as unknown as IOrdemServicoRepository;
    const history = {
      create: jest.fn(),
      findByOrdemServicoId: jest.fn(),
    } as unknown as jest.Mocked<IStatusHistoryRepository>;
    const emitter = { emitir: jest.fn() };
    const providers = providersFrom(OrdemServicoModule).filter((provider) => {
      if (typeof provider === 'function') return provider.name === 'StatusTransitionService';
      return [OS_STATUS_TRANSITION_LOGGER, AtualizarStatusEncerradaSemExecucaoHandler].includes(
        provider.provide as
          | typeof OS_STATUS_TRANSITION_LOGGER
          | typeof AtualizarStatusEncerradaSemExecucaoHandler
      );
    });
    const output = capturedTransitionLogs();
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        ...withTransitionLogger(providers, output),
        { provide: OrdemServicoRepository, useValue: repo },
        { provide: StatusHistoryRepository, useValue: history },
        { provide: EMISSOR_EVENTOS, useValue: emitter },
        { provide: RESERVA_ESTOQUE_PORT, useValue: reservaEstoque },
      ],
    }).compile();
    try {
      const handler = moduleRef.get(AtualizarStatusEncerradaSemExecucaoHandler);
      expect(moduleRef.get(OS_STATUS_TRANSITION_LOGGER)).toBeDefined();
      await handler.handle(new OrcamentoRecusado('sensitive-order-id', 'estimate-id'));
      expect(status).toBe('CLOSED_WITHOUT_EXECUTION');
      expectTransitionJson(output.lines, 'AWAITING_APPROVAL', 'CLOSED_WITHOUT_EXECUTION');
      expect(output.lines.join('')).not.toContain('sensitive-order-id');
    } finally {
      await moduleRef.close();
    }
  });

  it('uses effective detector module providers to emit after a successful CAS', async () => {
    const repo = {
      findParadasAguardandoAprovacao: jest.fn().mockResolvedValue([{ id: 'sensitive-order-id' }]),
      atualizarSeCondicao: jest.fn().mockResolvedValue(true),
    } as unknown as IOrdemServicoRepository;
    const history = { create: jest.fn() } as unknown as jest.Mocked<IStatusHistoryRepository>;
    const publisher: jest.Mocked<IPublicadorIntegracao> = {
      publicar: jest.fn().mockResolvedValue(undefined),
    };
    const providers = providersFrom(DetectorOsParadaModule).filter((provider) => {
      if (typeof provider === 'function') return false;
      return [OS_STATUS_TRANSITION_LOGGER, DetectarOsParadaUseCase].includes(
        provider.provide as typeof OS_STATUS_TRANSITION_LOGGER | typeof DetectarOsParadaUseCase
      );
    });
    const output = capturedTransitionLogs();
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        ...withTransitionLogger(providers, output),
        { provide: OrdemServicoRepository, useValue: repo },
        { provide: StatusHistoryRepository, useValue: history },
        { provide: PUBLICADOR_INTEGRACAO, useValue: publisher },
        { provide: RESERVA_ESTOQUE_PORT, useValue: reservaEstoque },
      ],
    }).compile();
    try {
      const detector = moduleRef.get(DetectarOsParadaUseCase);
      expect(moduleRef.get(OS_STATUS_TRANSITION_LOGGER)).toBeDefined();
      await detector.executar();
      expect(repo.atualizarSeCondicao).toHaveBeenCalledWith(
        'sensitive-order-id',
        { status: 'AWAITING_APPROVAL', pago_em: null },
        expect.objectContaining({ status: 'CLOSED_WITHOUT_EXECUTION' })
      );
      expectTransitionJson(output.lines, 'AWAITING_APPROVAL', 'CLOSED_WITHOUT_EXECUTION');
      expect(output.lines.join('')).not.toContain('sensitive-order-id');
    } finally {
      await moduleRef.close();
    }
  });

  it('uses the effective API finish handler provider after a successful CAS', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'sensitive-order-id', status: 'IN_PROGRESS' }),
      atualizarSeCondicao: jest.fn().mockResolvedValue(true),
    } as unknown as IOrdemServicoRepository;
    const history = { create: jest.fn(), findByOrdemServicoId: jest.fn() };
    const emitter = { emitir: jest.fn() };
    const providers = providersFrom(OrdemServicoModule).filter((provider) => {
      if (typeof provider === 'function') return provider.name === 'StatusTransitionService';
      return [OS_STATUS_TRANSITION_LOGGER, AtualizarStatusFinalizadaHandler].includes(
        provider.provide as
          | typeof OS_STATUS_TRANSITION_LOGGER
          | typeof AtualizarStatusFinalizadaHandler
      );
    });
    const output = capturedTransitionLogs();
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        ...withTransitionLogger(providers, output),
        { provide: OrdemServicoRepository, useValue: repo },
        { provide: StatusHistoryRepository, useValue: history },
        { provide: EMISSOR_EVENTOS, useValue: emitter },
      ],
    }).compile();
    try {
      const handler = moduleRef.get(AtualizarStatusFinalizadaHandler);
      expect(moduleRef.get(OS_STATUS_TRANSITION_LOGGER)).toBeDefined();
      await handler.handle(new ExecucaoConcluida('sensitive-order-id'));
      expect(repo.atualizarSeCondicao).toHaveBeenCalledWith(
        'sensitive-order-id',
        { status: 'IN_PROGRESS' },
        { status: 'FINISHED' }
      );
      expectTransitionJson(output.lines, 'IN_PROGRESS', 'FINISHED');
      expect(output.lines.join('')).not.toContain('sensitive-order-id');
    } finally {
      await moduleRef.close();
    }
  });

  it('uses the generic API provider to log terminal updates after repository persistence', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'sensitive-order-id', status: 'IN_PROGRESS' }),
      update: jest.fn().mockResolvedValue({ id: 'sensitive-order-id', status: 'FINISHED' }),
    } as unknown as IOrdemServicoRepository;
    const history = { create: jest.fn() } as unknown as jest.Mocked<IStatusHistoryRepository>;
    const emitter = { emitir: jest.fn() };
    const providers = providersFrom(OrdemServicoModule).filter((provider) => {
      if (typeof provider === 'function') return provider.name === 'StatusTransitionService';
      return [OS_STATUS_TRANSITION_LOGGER, UpdateServiceOrderStatusUseCase].includes(
        provider.provide as
          | typeof OS_STATUS_TRANSITION_LOGGER
          | typeof UpdateServiceOrderStatusUseCase
      );
    });
    const output = capturedTransitionLogs();
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        ...withTransitionLogger(providers, output),
        { provide: OrdemServicoRepository, useValue: repo },
        { provide: StatusHistoryRepository, useValue: history },
        { provide: EMISSOR_EVENTOS, useValue: emitter },
      ],
    }).compile();
    try {
      const useCase = moduleRef.get(UpdateServiceOrderStatusUseCase);
      expect(moduleRef.get(OS_STATUS_TRANSITION_LOGGER)).toBeDefined();
      await useCase.execute('sensitive-order-id', 'FINISHED');
      expect(repo.update).toHaveBeenCalledWith(
        'sensitive-order-id',
        expect.objectContaining({ status: 'FINISHED' })
      );
      expectTransitionJson(output.lines, 'IN_PROGRESS', 'FINISHED');
      expect(output.lines.join('')).not.toContain('sensitive-order-id');
    } finally {
      await moduleRef.close();
    }
  });
});
