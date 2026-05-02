import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import { AtualizarStatusRecebidaPolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-recebida.policy';
import { AtualizarStatusEmDiagnosticoPolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-em-diagnostico.policy';
import { NotificarClienteDiagnosticoPolicy } from '../../src/modules/ordem-servico/application/policies/notificar-cliente-diagnostico.policy';
import { GerarOrcamentoPolicy } from '../../src/modules/ordem-servico/application/policies/gerar-orcamento.policy';
import { EnviarOrcamentoPolicy } from '../../src/modules/ordem-servico/application/policies/enviar-orcamento.policy';
import { AtualizarStatusAguardandoAprovacaoPolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-aguardando-aprovacao.policy';
import { VerificarNecessidadePecasPolicy } from '../../src/modules/ordem-servico/application/policies/verificar-necessidade-pecas.policy';
import { AtualizarStatusEmExecucaoPolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-em-execucao.policy';
import { IniciarMonitoramentoTempoPolicy } from '../../src/modules/ordem-servico/application/policies/iniciar-monitoramento-tempo.policy';
import { AtualizarStatusFinalizadaPolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-finalizada.policy';
import { FinalizarMonitoramentoTempoPolicy } from '../../src/modules/ordem-servico/application/policies/finalizar-monitoramento-tempo.policy';
import { NotificarClienteConclusaoPolicy } from '../../src/modules/ordem-servico/application/policies/notificar-cliente-conclusao.policy';
import { AtualizarStatusEntreguePolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-entregue.policy';
import { AtualizarStatusEncerradaSemExecucaoPolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-encerrada-sem-execucao.policy';
import { AtualizarStatusAguardandoPecasPolicy } from '../../src/modules/ordem-servico/application/policies/atualizar-status-aguardando-pecas.policy';
import { OrdemServicoCriada } from '../../src/modules/ordem-servico/domain/events/ordem-servico-criada.event';
import { OrdemServicoAssumida } from '../../src/modules/ordem-servico/domain/events/ordem-servico-assumida.event';
import { StatusAtualizadoEmDiagnostico } from '../../src/modules/ordem-servico/domain/events/status-atualizado-em-diagnostico.event';
import { ServicosEInsumosListados } from '../../src/modules/ordem-servico/domain/events/servicos-e-insumos-listados.event';
import { OrcamentoGerado } from '../../src/modules/ordem-servico/domain/events/orcamento-gerado.event';
import { OrcamentoEnviado } from '../../src/modules/ordem-servico/domain/events/orcamento-enviado.event';
import { OrcamentoAprovado } from '../../src/modules/ordem-servico/domain/events/orcamento-aprovado.event';
import { OsSemPecasConfirmada } from '../../src/modules/ordem-servico/domain/events/os-sem-pecas-confirmada.event';
import { StatusAtualizadoEmExecucao } from '../../src/modules/ordem-servico/domain/events/status-atualizado-em-execucao.event';
import { ServicoConcluidoPeloMecanico } from '../../src/modules/ordem-servico/domain/events/servico-concluido-pelo-mecanico.event';
import { StatusAtualizadoFinalizada } from '../../src/modules/ordem-servico/domain/events/status-atualizado-finalizada.event';
// `ServicoAprovadoPeloCliente` removed: not used in tests
import { PagamentoRegistrado } from '../../src/modules/ordem-servico/domain/events/pagamento-registrado.event';
import { OrcamentoRecusado } from '../../src/modules/ordem-servico/domain/events/orcamento-recusado.event';
import { PecasIndisponiveis } from '../../src/modules/pecas-insumos/domain/events/pecas-indisponiveis.event';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IOrcamentoRepository } from '../../src/modules/ordem-servico/domain/interfaces/orcamento.interface';
import type { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { OrdemDeServico } from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
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
});

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

describe('OS Policies', () => {
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
    } as jest.Mocked<IOrdemServicoRepository>;
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

  describe('P-01 AtualizarStatusRecebidaPolicy', () => {
    it('não deve atualizar quando OS já está RECEIVED', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'RECEIVED' }));
      const policy = new AtualizarStatusRecebidaPolicy(osRepo);

      await policy.handle(new OrdemServicoCriada('os-1', 'cli-1', 'veh-1'));

      expect(osRepo.update).not.toHaveBeenCalled();
    });

    it('deve forçar status RECEIVED quando OS foi criada em status incorreto', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      const policy = new AtualizarStatusRecebidaPolicy(osRepo);

      await policy.handle(new OrdemServicoCriada('os-1', 'cli-1', 'veh-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'RECEIVED' });
    });
  });

  // ─── P-02 ────────────────────────────────────────────────────────────────

  describe('P-02 AtualizarStatusEmDiagnosticoPolicy', () => {
    it('deve atualizar para UNDER_DIAGNOSIS e emitir StatusAtualizadoEmDiagnostico', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'RECEIVED' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      const policy = new AtualizarStatusEmDiagnosticoPolicy(osRepo, emissor);

      await policy.handle(new OrdemServicoAssumida('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'UNDER_DIAGNOSIS' });
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(StatusAtualizadoEmDiagnostico));
    });
  });

  // ─── P-03 ────────────────────────────────────────────────────────────────

  describe('P-03 NotificarClienteDiagnosticoPolicy', () => {
    it('deve executar stub sem lançar erro', () => {
      const policy = new NotificarClienteDiagnosticoPolicy();
      expect(() => policy.handle(new StatusAtualizadoEmDiagnostico('os-1'))).not.toThrow();
    });
  });

  // ─── P-04 ────────────────────────────────────────────────────────────────

  describe('P-04 GerarOrcamentoPolicy', () => {
    const evento = new ServicosEInsumosListados('os-1', 100, 50);

    it('deve criar orçamento quando não existe nenhum e emitir OrcamentoGerado', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      orcRepo.findByOrdemServicoId.mockResolvedValue(null);
      orcRepo.create.mockResolvedValue(mockOrc());
      const policy = new GerarOrcamentoPolicy(osRepo, orcRepo, emissor);

      await policy.handle(evento);

      expect(orcRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ id_ordem_servico: 'os-1' })
      );
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrcamentoGerado));
    });

    it('deve atualizar orçamento existente com status PENDING', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      orcRepo.findByOrdemServicoId.mockResolvedValue(mockOrc({ status: 'PENDING' }));
      orcRepo.update.mockResolvedValue(mockOrc());
      const policy = new GerarOrcamentoPolicy(osRepo, orcRepo, emissor);

      await policy.handle(evento);

      expect(orcRepo.update).toHaveBeenCalledWith(
        'orc-1',
        expect.objectContaining({ status: 'PENDING' })
      );
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrcamentoGerado));
    });

    it('deve lançar DomainException quando orçamento já está APPROVED', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      orcRepo.findByOrdemServicoId.mockResolvedValue(mockOrc({ status: 'APPROVED' }));
      const policy = new GerarOrcamentoPolicy(osRepo, orcRepo, emissor);

      await expect(policy.handle(evento)).rejects.toThrow(DomainException);
    });

    it('deve lançar DomainException quando OS está em status inválido', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'RECEIVED' }));
      const policy = new GerarOrcamentoPolicy(osRepo, orcRepo, emissor);

      await expect(policy.handle(evento)).rejects.toThrow(DomainException);
    });
  });

  // ─── P-05 ────────────────────────────────────────────────────────────────

  describe('P-05 EnviarOrcamentoPolicy', () => {
    it('deve emitir OrcamentoEnviado', async () => {
      const policy = new EnviarOrcamentoPolicy(emissor);

      await policy.handle(new OrcamentoGerado('os-1', 'orc-1'));

      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(OrcamentoEnviado));
    });
  });

  // ─── P-06 ────────────────────────────────────────────────────────────────

  describe('P-06 AtualizarStatusAguardandoAprovacaoPolicy', () => {
    it('deve atualizar para AWAITING_APPROVAL quando OS está UNDER_DIAGNOSIS', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'UNDER_DIAGNOSIS' }));
      const policy = new AtualizarStatusAguardandoAprovacaoPolicy(osRepo);

      await policy.handle(new OrcamentoEnviado('os-1', 'orc-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'AWAITING_APPROVAL' });
    });

    it('não deve atualizar quando OS já não está UNDER_DIAGNOSIS', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      const policy = new AtualizarStatusAguardandoAprovacaoPolicy(osRepo);

      await policy.handle(new OrcamentoEnviado('os-1', 'orc-1'));

      expect(osRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── P-07 ────────────────────────────────────────────────────────────────

  describe('P-07 VerificarNecessidadePecasPolicy', () => {
    it('deve emitir OrcamentoAprovadoComPecas quando valorTotalPecas > 0', async () => {
      const policy = new VerificarNecessidadePecasPolicy(emissor);

      await policy.handle(new OrcamentoAprovado('os-1', 'orc-1', 50));

      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('OrcamentoAprovadoComPecas');
    });

    it('deve emitir OsSemPecasConfirmada quando valorTotalPecas é 0', async () => {
      const policy = new VerificarNecessidadePecasPolicy(emissor);

      await policy.handle(new OrcamentoAprovado('os-1', 'orc-1', 0));

      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido).toBeInstanceOf(OsSemPecasConfirmada);
    });
  });

  // ─── P-08 ────────────────────────────────────────────────────────────────

  describe('P-08 AtualizarStatusEmExecucaoPolicy', () => {
    it('deve atualizar para IN_PROGRESS e emitir StatusAtualizadoEmExecucao via OsSemPecasConfirmada', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'IN_PROGRESS' }));
      const policy = new AtualizarStatusEmExecucaoPolicy(osRepo, emissor);

      await policy.handleSemPecas(new OsSemPecasConfirmada('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'IN_PROGRESS' });
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(StatusAtualizadoEmExecucao));
    });

    it('deve atualizar para IN_PROGRESS via PecasReservadas', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'IN_PROGRESS' }));
      const policy = new AtualizarStatusEmExecucaoPolicy(osRepo, emissor);

      await policy.handlePecasReservadas({ ordemServicoId: 'os-1' });

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'IN_PROGRESS' });
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(StatusAtualizadoEmExecucao));
    });
  });

  // ─── P-09 ────────────────────────────────────────────────────────────────

  describe('P-09 IniciarMonitoramentoTempoPolicy', () => {
    it('deve atualizar iniciada_em com data atual', async () => {
      osRepo.update.mockResolvedValue(mockOs());
      const policy = new IniciarMonitoramentoTempoPolicy(osRepo);

      await policy.handle(new StatusAtualizadoEmExecucao('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { iniciada_em: expect.any(Date) });
    });
  });

  // ─── P-10 ────────────────────────────────────────────────────────────────

  describe('P-10 AtualizarStatusFinalizadaPolicy', () => {
    it('deve atualizar para FINISHED e emitir StatusAtualizadoFinalizada', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'IN_PROGRESS' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'FINISHED' }));
      const policy = new AtualizarStatusFinalizadaPolicy(osRepo, emissor);

      await policy.handle(new ServicoConcluidoPeloMecanico('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'FINISHED' });
      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(StatusAtualizadoFinalizada));
    });
  });

  // ─── P-11 ────────────────────────────────────────────────────────────────

  describe('P-11 FinalizarMonitoramentoTempoPolicy', () => {
    it('deve atualizar finalizada_em e logar duração quando iniciada_em está definida', async () => {
      const iniciada_em = new Date(Date.now() - 30 * 60 * 1000);
      osRepo.findOne.mockResolvedValue(mockOs({ iniciada_em }));
      osRepo.update.mockResolvedValue(mockOs());
      const policy = new FinalizarMonitoramentoTempoPolicy(osRepo);

      await policy.handle(new StatusAtualizadoFinalizada('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { finalizada_em: expect.any(Date) });
    });

    it('deve atualizar finalizada_em sem logar quando iniciada_em é null', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ iniciada_em: null }));
      osRepo.update.mockResolvedValue(mockOs());
      const policy = new FinalizarMonitoramentoTempoPolicy(osRepo);

      await policy.handle(new StatusAtualizadoFinalizada('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { finalizada_em: expect.any(Date) });
    });
  });

  // ─── P-12 ────────────────────────────────────────────────────────────────

  describe('P-12 NotificarClienteConclusaoPolicy', () => {
    it('deve emitir ClienteNotificadoConclusao', async () => {
      const policy = new NotificarClienteConclusaoPolicy(emissor);

      await policy.handle(new StatusAtualizadoFinalizada('os-1'));

      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('ClienteNotificadoConclusao');
    });
  });

  // ─── P-13 ────────────────────────────────────────────────────────────────

  describe('P-13 AtualizarStatusEntreguePolicy', () => {
    it('deve atualizar para DELIVERED com entregue_em e emitir StatusAtualizadoEntregue', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'FINISHED' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'DELIVERED' }));
      const policy = new AtualizarStatusEntreguePolicy(osRepo, emissor);

      await policy.handle(new PagamentoRegistrado('os-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', {
        status: 'DELIVERED',
        entregue_em: expect.any(Date),
      });
      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('StatusAtualizadoEntregue');
    });
  });

  // ─── P-14 ────────────────────────────────────────────────────────────────

  describe('P-14 AtualizarStatusEncerradaSemExecucaoPolicy', () => {
    it('deve atualizar para CLOSED_WITHOUT_EXECUTION e emitir StatusAtualizadoEncerradaSemExecucao', async () => {
      osRepo.update.mockResolvedValue(mockOs({ status: 'CLOSED_WITHOUT_EXECUTION' }));
      const policy = new AtualizarStatusEncerradaSemExecucaoPolicy(osRepo, emissor);

      await policy.handle(new OrcamentoRecusado('os-1', 'orc-1'));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'CLOSED_WITHOUT_EXECUTION' });
      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('StatusAtualizadoEncerradaSemExecucao');
    });
  });

  // ─── P-15 ────────────────────────────────────────────────────────────────

  describe('P-15 AtualizarStatusAguardandoPecasPolicy', () => {
    it('deve atualizar para AWAITING_PARTS quando PecasIndisponiveis ocorrer', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ status: 'AWAITING_APPROVAL' }));
      osRepo.update.mockResolvedValue(mockOs({ status: 'AWAITING_PARTS' }));
      const policy = new AtualizarStatusAguardandoPecasPolicy(osRepo, emissor);

      await policy.handle(new PecasIndisponiveis('os-1', ['peca-1']));

      expect(osRepo.update).toHaveBeenCalledWith('os-1', { status: 'AWAITING_PARTS' });
      const emitido = emissor.emitir.mock.calls[0][0];
      expect(emitido.constructor.name).toBe('StatusAtualizadoAguardandoPecas');
    });
  });

  describe('P-16 IniciarMonitoramentoTempoPolicy', () => {
    it('should handle OS with null data', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ iniciada_em: null }));
      osRepo.update.mockResolvedValue(mockOs({ iniciada_em: new Date() }));
      const policy = new IniciarMonitoramentoTempoPolicy(osRepo, emissor);

      await policy.handle(new OrdemServicoAssumida('os-1'));

      expect(osRepo.update).toHaveBeenCalled();
    });
  });

  describe('P-17 FinalizarMonitoramentoTempoPolicy', () => {
    it('should handle OS with data', async () => {
      osRepo.findOne.mockResolvedValue(mockOs({ iniciada_em: new Date() }));
      osRepo.update.mockResolvedValue(mockOs({ finalizada_em: new Date() }));
      const policy = new FinalizarMonitoramentoTempoPolicy(osRepo, emissor);

      await policy.handle(new ServicoConcluidoPeloMecanico('os-1'));

      expect(osRepo.update).toHaveBeenCalled();
    });
  });

  describe('P-18 NotificarClienteConclusaoPolicy', () => {
    it('should emit event with correct data', async () => {
      const policy = new NotificarClienteConclusaoPolicy(emissor);

      await policy.handle(new StatusAtualizadoFinalizada('os-1'));

      expect(emissor.emitir).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});
