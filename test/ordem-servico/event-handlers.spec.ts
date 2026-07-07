import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import { AtualizarStatusRecebidaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-recebida.handler';
import { AtualizarStatusEmDiagnosticoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-em-diagnostico.handler';
import { NotificarClienteDiagnosticoHandler } from '../../src/modules/ordem-servico/application/event-handlers/notificar-cliente-diagnostico.handler';
import { GerarOrcamentoHandler } from '../../src/modules/ordem-servico/application/event-handlers/gerar-orcamento.handler';
import { EnviarOrcamentoHandler } from '../../src/modules/ordem-servico/application/event-handlers/enviar-orcamento.handler';
import { AtualizarStatusAguardandoAprovacaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-aguardando-aprovacao.handler';
import { VerificarNecessidadePecasHandler } from '../../src/modules/ordem-servico/application/event-handlers/verificar-necessidade-pecas.handler';
import { AtualizarStatusEmExecucaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-em-execucao.handler';
import { IniciarMonitoramentoTempoHandler } from '../../src/modules/ordem-servico/application/event-handlers/iniciar-monitoramento-tempo.handler';
import { AtualizarStatusFinalizadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-finalizada.handler';
import { FinalizarMonitoramentoTempoHandler } from '../../src/modules/ordem-servico/application/event-handlers/finalizar-monitoramento-tempo.handler';
import { NotificarClienteConclusaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/notificar-cliente-conclusao.handler';
import { AtualizarStatusEntregueHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-entregue.handler';
import { AtualizarStatusEncerradaSemExecucaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-encerrada-sem-execucao.handler';
import { AtualizarStatusAguardandoPecasHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-aguardando-pecas.handler';
import { OrdemServicoCriada } from '../../src/modules/ordem-servico/domain/events/ordem-servico-criada.event';
import { OrdemServicoAssumida } from '../../src/modules/ordem-servico/domain/events/ordem-servico-assumida.event';
import { StatusAtualizadoEmDiagnostico } from '../../src/modules/ordem-servico/domain/events/status-atualizado-em-diagnostico.event';
import { ServicosEInsumosListados } from '../../src/modules/ordem-servico/domain/events/servicos-e-insumos-listados.event';
import { OrcamentoGerado } from '../../src/modules/ordem-servico/domain/events/orcamento-gerado.event';
import { OrcamentoEnviado } from '../../src/modules/ordem-servico/domain/events/orcamento-enviado.event';
import { OrcamentoAprovado } from '../../src/modules/ordem-servico/domain/events/orcamento-aprovado.event';
import { OrdemServicoEmDiagnostico } from '../../src/modules/ordem-servico/domain/events/ordem-servico-em-diagnostico.event';
import { OrdemServicoEmExecucao } from '../../src/modules/ordem-servico/domain/events/ordem-servico-em-execucao.event';
import { OrdemServicoFinalizada } from '../../src/modules/ordem-servico/domain/events/ordem-servico-finalizada.event';
import { OrdemServicoEntregue } from '../../src/modules/ordem-servico/domain/events/ordem-servico-entregue.event';
import { OsSemPecasConfirmada } from '../../src/modules/ordem-servico/domain/events/os-sem-pecas-confirmada.event';
import { ServicoConcluidoPeloMecanico } from '../../src/modules/ordem-servico/domain/events/servico-concluido-pelo-mecanico.event';
// `ServicoAprovadoPeloCliente` removed: not used in tests
import { PagamentoRegistrado } from '../../src/modules/ordem-servico/domain/events/pagamento-registrado.event';
import { OrcamentoRecusado } from '../../src/modules/ordem-servico/domain/events/orcamento-recusado.event';
import { PecasIndisponiveis } from '../../src/modules/pecas-insumos/domain/events/pecas-indisponiveis.event';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IOrcamentoRepository } from '../../src/modules/ordem-servico/domain/interfaces/orcamento.interface';
import type { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { OrdemDeServico, OSStatus } from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import type { Orcamento } from '../../src/modules/ordem-servico/domain/entities/orcamento.entity';

const mockOs = (overrides: Partial<OrdemDeServico> = {}): OrdemDeServico => ({
  id: 'os-1',
  veiculoId: 'veh-1',
  clienteId: 'cli-1',
  status: 'RECEIVED',
  descricao: null,
  iniciada_em: null,
  finalizada_em: null,
  entregue_em: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
} as OrdemDeServico);

const mockOrc = (overrides: Partial<Orcamento> = {}): Orcamento => ({
  id: 'orc-1',
  id_ordem_servico: 'os-1',
  valor_total_servicos: 100,
  valor_total_pecas: 50,
  valor_total_geral: 150,
  status: 'PENDING',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

/** Test helper: verifies handler should NOT update when OS has wrong status */
async function shouldNotUpdateWhenStatusIs(
  osRepo: jest.Mocked<IOrdemServicoRepository>,
  handlerInstance: unknown,
  wrongStatus: OSStatus,
  event: unknown,
  methodName = 'handle'
): Promise<void> {
  osRepo.findOne.mockResolvedValue(mockOs({ status: wrongStatus }));
  await (handlerInstance as Record<string, (e: unknown) => Promise<void>>)[methodName](event);
  expect(osRepo.update).not.toHaveBeenCalled();
}

/** Test helper: verifies handler updates OS to IN_PROGRESS and emits StatusAtualizadoEmExecucao */
async function shouldUpdateToInProgress(
  osRepo: jest.Mocked<IOrdemServicoRepository>,
  emissor: jest.Mocked<EmissorEventos>,
  status: OSStatus,
  handler: () => Promise<void>
): Promise<void> {
  osRepo.findOne.mockResolvedValue(mockOs({ status }));
  osRepo.update.mockResolvedValue(mockOs({ status: 'IN_PROGRESS' }));
  await handler();
  expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'IN_PROGRESS' });
  expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrdemServicoEmExecucao));
}

describe('OS Event handlers', () => {
  let osRepo: jest.Mocked<IOrdemServicoRepository>;
  let orcRepo: jest.Mocked<IOrcamentoRepository>;
  let emissor: jest.Mocked<EmissorEventos>;

  beforeEach(() => {
    osRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<IOrdemServicoRepository>;
    orcRepo = {
      findByOrdemServicoId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as jest.Mocked<IOrcamentoRepository>;
    emissor = {
      emitir: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmissorEventos>;
  });

  // ─── P-01 ────────────────────────────────────────────────────────────────

  describe('P-01 AtualizarStatusRecebidaHandler', () => {
    it('não deve atualizar quando OS já está RECEIVED', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'RECEIVED' }));
      const handler = new AtualizarStatusRecebidaHandler(osRepo);

      await handler.handle(new OrdemServicoCriada('os-1', 'cli-1', 'veh-1'));

      expect(osRepo.update).not.toHaveBeenCalled();
    });

    it('deve forçar status RECEIVED quando OS foi criada em status incorreto', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      const handler = new AtualizarStatusRecebidaHandler(osRepo);

      await handler.handle(new OrdemServicoCriada('os-1', 'cli-1', 'veh-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'RECEIVED' });
    });
  });

  // ─── P-02 ────────────────────────────────────────────────────────────────

  describe('P-02 AtualizarStatusEmDiagnosticoHandler', () => {
    it('deve atualizar para UNDER_DIAGNOSIS e emitir StatusAtualizadoEmDiagnostico', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'RECEIVED' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      const handler = new AtualizarStatusEmDiagnosticoHandler(osRepo, emissor);

      await handler.handle(new OrdemServicoAssumida('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'UNDER_DIAGNOSIS' });
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrdemServicoEmDiagnostico));
    });

    it('não deve atualizar quando OS não está em RECEIVED', async () => {
      const handler = new AtualizarStatusEmDiagnosticoHandler(osRepo, emissor);
      await shouldNotUpdateWhenStatusIs(
        osRepo,
        handler,
        'UNDER_DIAGNOSIS',
        new OrdemServicoAssumida('os-1')
      );
    });
  });

  // ─── P-03 ────────────────────────────────────────────────────────────────

  describe('P-03 NotificarClienteDiagnosticoHandler', () => {
    it('deve executar stub sem lançar erro', () => {
      const handler = new NotificarClienteDiagnosticoHandler();
      expect(() => handler.handle(new StatusAtualizadoEmDiagnostico('os-1'))).not.toThrow();
    });
  });

  // ─── P-04 ────────────────────────────────────────────────────────────────

  describe('P-04 GerarOrcamentoHandler', () => {
    const evento = new ServicosEInsumosListados('os-1', 100, 50);

    it('deve criar orçamento quando não existe nenhum e emitir OrcamentoGerado', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      orcRepo.findByOrdemServicoId.mockResolvedValue(null);
      orcRepo.create.mockResolvedValue(mockOrc());
      const handler = new GerarOrcamentoHandler(osRepo, orcRepo, emissor);

      await handler.handle(evento);

      expect(orcRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ id_ordem_servico: 'os-1' })
      );
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrcamentoGerado));
    });

    it('deve atualizar orçamento existente com status PENDING', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      orcRepo.findByOrdemServicoId.mockResolvedValue(mockOrc({ status: 'PENDING' }));
      orcRepo.update.mockResolvedValue(mockOrc());
      const handler = new GerarOrcamentoHandler(osRepo, orcRepo, emissor);

      await handler.handle(evento);

      expect(orcRepo.update).toHaveBeenCalledWith(
        'orc-1',
        expect.objectContaining({ status: 'PENDING' })
      );
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrcamentoGerado));
    });

    it('deve lançar DomainException quando orçamento já está APPROVED', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      orcRepo.findByOrdemServicoId.mockResolvedValue(mockOrc({ status: 'APPROVED' }));
      const handler = new GerarOrcamentoHandler(osRepo, orcRepo, emissor);

      await expect(handler.handle(evento)).rejects.toThrow(DomainException);
    });

    it('deve lançar DomainException quando OS está em status inválido', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'RECEIVED' }));
      const handler = new GerarOrcamentoHandler(osRepo, orcRepo, emissor);

      await expect(handler.handle(evento)).rejects.toThrow(DomainException);
    });
  });

  // ─── P-05 ────────────────────────────────────────────────────────────────

  describe('P-05 EnviarOrcamentoHandler', () => {
    it('deve emitir OrcamentoEnviado', async () => {
      const handler = new EnviarOrcamentoHandler(emissor);

      await handler.handle(new OrcamentoGerado('os-1', 'orc-1'));

      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrcamentoEnviado));
    });
  });

  // ─── P-06 ────────────────────────────────────────────────────────────────

  describe('P-06 AtualizarStatusAguardandoAprovacaoHandler', () => {
    it('deve atualizar para AWAITING_APPROVAL quando OS está UNDER_DIAGNOSIS', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      const handler = new AtualizarStatusAguardandoAprovacaoHandler(osRepo);

      await handler.handle(new OrcamentoEnviado('os-1', 'orc-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'AWAITING_APPROVAL' });
    });

    it('não deve atualizar quando OS já não está UNDER_DIAGNOSIS', async () => {
      const handler = new AtualizarStatusAguardandoAprovacaoHandler(osRepo);
      await shouldNotUpdateWhenStatusIs(
        osRepo,
        handler,
        'AWAITING_APPROVAL',
        new OrcamentoEnviado('os-1', 'orc-1')
      );
    });
  });

  // ─── P-07 ────────────────────────────────────────────────────────────────

  describe('P-07 VerificarNecessidadePecasHandler', () => {
    it('deve emitir OrcamentoAprovadoComPecas quando valorTotalPecas > 0', async () => {
      const handler = new VerificarNecessidadePecasHandler(emissor);

      await handler.handle(new OrcamentoAprovado('os-1', 'orc-1', 50));

      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('OrcamentoAprovadoComPecas');
    });

    it('deve emitir OsSemPecasConfirmada quando valorTotalPecas é 0', async () => {
      const handler = new VerificarNecessidadePecasHandler(emissor);

      await handler.handle(new OrcamentoAprovado('os-1', 'orc-1', 0));

      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido).toBeInstanceOf(OsSemPecasConfirmada);
    });
  });

  // ─── P-08 ────────────────────────────────────────────────────────────────

  describe('P-08 AtualizarStatusEmExecucaoHandler', () => {
    it('deve atualizar para IN_PROGRESS e emitir StatusAtualizadoEmExecucao via OsSemPecasConfirmada', async () => {
      const handler = new AtualizarStatusEmExecucaoHandler(osRepo, emissor);
      await shouldUpdateToInProgress(osRepo, emissor, 'AWAITING_APPROVAL', () =>
        handler.handleSemPecas(new OsSemPecasConfirmada('os-1'))
      );
    });

    it('deve atualizar para IN_PROGRESS via PecasReservadas quando OS em AWAITING_APPROVAL', async () => {
      const handler = new AtualizarStatusEmExecucaoHandler(osRepo, emissor);
      await shouldUpdateToInProgress(osRepo, emissor, 'AWAITING_APPROVAL', () =>
        handler.handlePecasReservadas({ ordemServicoId: 'os-1' })
      );
    });

    it('deve atualizar para IN_PROGRESS via PecasReservadas quando OS em AWAITING_PARTS', async () => {
      const handler = new AtualizarStatusEmExecucaoHandler(osRepo, emissor);
      await shouldUpdateToInProgress(osRepo, emissor, 'AWAITING_PARTS', () =>
        handler.handlePecasReservadas({ ordemServicoId: 'os-1' })
      );
    });

    it('não deve atualizar quando OS não está em AWAITING_APPROVAL', async () => {
      const handler = new AtualizarStatusEmExecucaoHandler(osRepo, emissor);
      await shouldNotUpdateWhenStatusIs(
        osRepo,
        handler,
        'IN_PROGRESS',
        new OsSemPecasConfirmada('os-1'),
        'handleSemPecas'
      );
    });
  });

  // ─── P-09 ────────────────────────────────────────────────────────────────

  describe('P-09 IniciarMonitoramentoTempoHandler', () => {
    it('deve atualizar iniciada_em com data atual', async () => {
      osRepo.update.mockResolvedValue(mockOs());
      const handler = new IniciarMonitoramentoTempoHandler(osRepo);

      await handler.handle(new OrdemServicoEmExecucao('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { iniciada_em: expect.any(Date) });
    });
  });

  // ─── P-10 ────────────────────────────────────────────────────────────────

  describe('P-10 AtualizarStatusFinalizadaHandler', () => {
    it('deve atualizar para FINISHED e emitir StatusAtualizadoFinalizada', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'IN_PROGRESS' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'FINISHED' }));
      const handler = new AtualizarStatusFinalizadaHandler(osRepo, emissor);

      await handler.handle(new ServicoConcluidoPeloMecanico('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'FINISHED' });
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrdemServicoFinalizada));
    });

    it('não deve atualizar quando OS não está em IN_PROGRESS', async () => {
      const handler = new AtualizarStatusFinalizadaHandler(osRepo, emissor);
      await shouldNotUpdateWhenStatusIs(
        osRepo,
        handler,
        'RECEIVED',
        new ServicoConcluidoPeloMecanico('os-1')
      );
    });
  });

  // ─── P-11 ────────────────────────────────────────────────────────────────

  describe('P-11 FinalizarMonitoramentoTempoHandler', () => {
    it('deve atualizar finalizada_em e logar duração quando iniciada_em está definida', async () => {
      const iniciada_em = new Date(Date.now() - 30 * 60 * 1000);
      osRepo.findOne.mockResolvedValue(mockOs({ iniciada_em }));
      osRepo.update.mockResolvedValue(mockOs());
      const handler = new FinalizarMonitoramentoTempoHandler(osRepo);

      await handler.handle(new OrdemServicoFinalizada('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { finalizada_em: expect.any(Date) });
    });

    it('deve atualizar finalizada_em sem logar quando iniciada_em é null', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ iniciada_em: null }));
      osRepo.update.mockResolvedValue(mockOs());
      const handler = new FinalizarMonitoramentoTempoHandler(osRepo);

      await handler.handle(new OrdemServicoFinalizada('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { finalizada_em: expect.any(Date) });
    });
  });

  // ─── P-12 ────────────────────────────────────────────────────────────────

  describe('P-12 NotificarClienteConclusaoHandler', () => {
    it('deve emitir ClienteNotificadoConclusao', async () => {
      const handler = new NotificarClienteConclusaoHandler(emissor);

      await handler.handle(new OrdemServicoFinalizada('os-1'));

      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('ClienteNotificadoConclusao');
    });
  });

  // ─── P-13 ────────────────────────────────────────────────────────────────

  describe('P-13 AtualizarStatusEntregueHandler', () => {
    it('deve atualizar para DELIVERED com entregue_em e emitir StatusAtualizadoEntregue', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'FINISHED' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'DELIVERED' }));
      const handler = new AtualizarStatusEntregueHandler(osRepo, emissor);

      await handler.handle(new PagamentoRegistrado('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', {
        status: 'DELIVERED',
        entregue_em: expect.any(Date),
      });
      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('OrdemServicoEntregue');
    });

    it('não deve atualizar quando OS não está em FINISHED', async () => {
      const handler = new AtualizarStatusEntregueHandler(osRepo, emissor);
      await shouldNotUpdateWhenStatusIs(
        osRepo,
        handler,
        'IN_PROGRESS',
        new PagamentoRegistrado('os-1')
      );
    });
  });

  // ─── P-14 ────────────────────────────────────────────────────────────────

  describe('P-14 AtualizarStatusEncerradaSemExecucaoHandler', () => {
    it('deve atualizar para CLOSED_WITHOUT_EXECUTION e emitir StatusAtualizadoEncerradaSemExecucao', async () => {
      osRepo.update.mockResolvedValue(mockOs({ status: 'CLOSED_WITHOUT_EXECUTION' }));
      const handler = new AtualizarStatusEncerradaSemExecucaoHandler(osRepo, emissor);

      await handler.handle(new OrcamentoRecusado('os-1', 'orc-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'CLOSED_WITHOUT_EXECUTION' });
      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('StatusAtualizadoEncerradaSemExecucao');
    });
  });

  // ─── P-15 ────────────────────────────────────────────────────────────────

  describe('P-15 AtualizarStatusAguardandoPecasHandler', () => {
    it('deve atualizar para AWAITING_PARTS quando PecasIndisponiveis ocorrer', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'AWAITING_PARTS' }));
      const handler = new AtualizarStatusAguardandoPecasHandler(osRepo, emissor);

      await handler.handle(new PecasIndisponiveis('os-1', ['peca-1']));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'AWAITING_PARTS' });
      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('StatusAtualizadoAguardandoPecas');
    });

    it('não deve atualizar quando OS não está em AWAITING_APPROVAL', async () => {
      const handler = new AtualizarStatusAguardandoPecasHandler(osRepo, emissor);
      await shouldNotUpdateWhenStatusIs(
        osRepo,
        handler,
        'IN_PROGRESS',
        new PecasIndisponiveis('os-1', ['peca-1'])
      );
    });
  });
});
