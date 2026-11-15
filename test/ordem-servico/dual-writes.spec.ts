import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Db } from 'mongodb';
import { CriarOrdemServicoUseCase } from '../../src/modules/ordem-servico/application/use-cases/ordem-servico.use-cases';
import { OrdemServicoRepository } from '../../src/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository';
import { OsReadModelProjector } from '../../src/modules/ordem-servico/infrastructure/read-model/os-read-model.projector';
import { PonteEventosIntegracaoListener } from '../../src/modules/ordem-servico/infrastructure/messaging/ponte-eventos-integracao.listener';
import { OrdemServicoRecebida } from '../../src/modules/ordem-servico/domain/events/ordem-servico-recebida.event';
import {
  READ_MODEL_FAILURE_EVENT,
  ReadModelFailureReporter,
} from '../../src/shared/infrastructure/read-model/read-model-failure.reporter';
import { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';

// #331 (ADR-0018, "Os dois dual-writes do OS Service"): depois do commit no Postgres, a abertura
// da OS escreve em dois lugares fora da transação, o evento no Kafka e o read model no
// DocumentDB. Os dois lados no mesmo teste, com as peças reais: nenhum desfaz o commit nem
// derruba o request, e cada um falha de um jeito.
describe('Dual-writes da abertura da OS: evento no Kafka e read model', () => {
  const agora = new Date('2026-11-11T12:00:00.000Z');
  const linhaOs = {
    id: 'os-1',
    id_veiculo: 'vei-1',
    id_cliente: 'cli-1',
    status: 'RECEIVED',
    descricao: 'Barulho no motor',
    iniciada_em: null,
    finalizada_em: null,
    entregue_em: null,
    reserva_pecas_pendente: false,
    pago_em: null,
    created_at: agora,
    updated_at: agora,
    cliente: { id: 'cli-1', nome: 'Ana', documento: '15350946056' },
    veiculo: { id: 'vei-1', placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno' },
  };

  let ordem: string[];
  let prisma: {
    $transaction: jest.Mock;
    ordemServico: { findUnique: jest.Mock };
  };
  let replaceOne: jest.Mock;
  let recordCustomEvent: jest.Mock;
  let publicar: jest.Mock;
  let useCase: CriarOrdemServicoUseCase;
  let eventEmitter: EventEmitter2;

  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, nivel).mockImplementation();
    ordem = [];

    const tx = {
      ordemServico: {
        create: jest.fn(() => {
          ordem.push('postgres');
          return Promise.resolve(linhaOs);
        }),
      },
      historicoStatusOS: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      ordemServico: { findUnique: jest.fn().mockResolvedValue(linhaOs) },
    };
    replaceOne = jest.fn(() => {
      ordem.push('read-model');
      return Promise.reject(new Error('DocumentDB indisponível'));
    });
    const db = { collection: () => ({ replaceOne, deleteOne: jest.fn() }) } as unknown as Db;
    recordCustomEvent = jest.fn();
    const projector = new OsReadModelProjector(
      prisma as unknown as PrismaService,
      db,
      new ReadModelFailureReporter(recordCustomEvent)
    );
    const repository = new OrdemServicoRepository(prisma as unknown as PrismaService, projector);

    publicar = jest.fn(() => {
      ordem.push('kafka');
      return Promise.reject(new Error('broker indisponível'));
    });
    const ponte = new PonteEventosIntegracaoListener({ publicar } as IPublicadorIntegracao);
    eventEmitter = new EventEmitter2();
    eventEmitter.on('OrdemServicoRecebida', (evento: OrdemServicoRecebida) =>
      ponte.onOrdemServicoRecebida(evento)
    );

    useCase = new CriarOrdemServicoUseCase(
      repository,
      {
        findByDocumento: jest.fn().mockResolvedValue({ id: 'cli-1' }),
      } as never,
      {
        findByPlaca: jest.fn().mockResolvedValue({ id: 'vei-1', clienteId: 'cli-1' }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new EmissorEventos(eventEmitter)
    );
  });

  afterEach(() => jest.restoreAllMocks());

  const abrir = () =>
    useCase.execute({
      cliente: {
        nome: 'Ana',
        email: 'ana@example.com',
        documento: '15350946056',
        tipoDocumento: 'CPF',
      },
      veiculo: { placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2020 },
      servicos: [],
      pecas: [],
      descricao: 'Barulho no motor',
    });

  it('com o Kafka e o DocumentDB fora, a OS é criada e o request não falha', async () => {
    const os = await abrir();

    expect(os.id).toBe('os-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('as duas escritas externas acontecem só depois do commit no Postgres', async () => {
    await abrir();
    await new Promise((resolve) => setImmediate(resolve));

    expect(ordem[0]).toBe('postgres');
    expect(ordem.slice(1).sort()).toEqual(['kafka', 'read-model']);
  });

  it('read model: a falha vira ReadModelProjectionFailure e o documento fica para o rebuild', async () => {
    await abrir();

    expect(replaceOne).toHaveBeenCalledTimes(1);
    expect(recordCustomEvent).toHaveBeenCalledWith(
      READ_MODEL_FAILURE_EVENT,
      expect.objectContaining({ collection: 'os_read_model', documentId: 'os-1' })
    );
  });

  it('evento: sem outbox, a publicação falha uma vez, fica no log e não é refeita', async () => {
    await abrir();
    await new Promise((resolve) => setImmediate(resolve));

    expect(publicar).toHaveBeenCalledTimes(1);
    expect(publicar.mock.calls[0][0]).toBeInstanceOf(OrdemServicoRecebida);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('Falha ao publicar OrdemServicoRecebida da OS os-1')
    );
  });
});
