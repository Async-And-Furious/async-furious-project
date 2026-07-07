import { Module } from '@nestjs/common';
import { OrdemServicoController } from './presentation/controllers/ordem-servico.controller';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { OrcamentoRepository } from './infrastructure/repositories/orcamento.repository';
import { OsPecaRepository } from './infrastructure/repositories/os-peca.repository';
import { OsServicoRepository } from './infrastructure/repositories/os-servico.repository';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { ClienteRepository } from '../cadastro/infrastructure/repositories/cliente.repository';
import { VeiculoRepository } from '../cadastro/infrastructure/repositories/veiculo.repository';
import { ServicoRepository } from '../cadastro/infrastructure/repositories/servico.repository';
import { PecaInsumoRepository } from '../pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import {
  EMISSOR_EVENTOS,
  IEmissorEventos,
} from '../../shared/domain/interfaces/emissor-eventos.interface';
import { OrdemServicoBacklogAdapter } from './infrastructure/adapters/ordem-servico-backlog.adapter';
import { ORDEM_SERVICO_BACKLOG_PORT } from '../../shared/domain/interfaces/ordem-servico-backlog.port';
import {
  CriarOrdemServicoUseCase,
  AssumirOrdemServicoUseCase,
  AnalisarVeiculoUseCase,
  ListarServicosInsumosNaOsUseCase,
  AtualizarOrdemServicoUseCase,
  FinalizarExecucaoUseCase,
  AprovarServicoPrestadoUseCase,
  RegistrarEntregaVeiculoUseCase,
  ConsultarStatusOrdemServicoUseCase,
  ListarOrdensServicoUseCase,
  DetalharOrdemServicoUseCase,
  DeletarOrdemServicoUseCase,
} from './application/use-cases/ordem-servico.use-cases';
import { UpdateServiceOrderStatusUseCase } from './application/use-cases/update-service-order-status.use-case';
import { StatusTransitionService } from './domain/services/status-transition.service';
import { StatusHistoryRepository } from './infrastructure/repositories/status-history.repository';
import { ServiceOrderStatusWebhookController } from './presentation/controllers/service-order-status-webhook.controller';
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from './application/use-cases/orcamento.use-cases';
import { ConsultarTempoMedioExecucaoUseCase } from './application/use-cases/tempo-medio-execucao.use-case';
// Event handlers
import { AtualizarStatusRecebidaHandler } from './application/event-handlers/atualizar-status-recebida.handler';
import { AtualizarStatusEmDiagnosticoHandler } from './application/event-handlers/atualizar-status-em-diagnostico.handler';
import { NotificarClienteDiagnosticoHandler } from './application/event-handlers/notificar-cliente-diagnostico.handler';
import { GerarOrcamentoHandler } from './application/event-handlers/gerar-orcamento.handler';
import { EnviarOrcamentoHandler } from './application/event-handlers/enviar-orcamento.handler';
import { AtualizarStatusAguardandoAprovacaoHandler } from './application/event-handlers/atualizar-status-aguardando-aprovacao.handler';
import { VerificarNecessidadePecasHandler } from './application/event-handlers/verificar-necessidade-pecas.handler';
import { AtualizarStatusEmExecucaoHandler } from './application/event-handlers/atualizar-status-em-execucao.handler';
import { IniciarMonitoramentoTempoHandler } from './application/event-handlers/iniciar-monitoramento-tempo.handler';
import { AtualizarStatusFinalizadaHandler } from './application/event-handlers/atualizar-status-finalizada.handler';
import { FinalizarMonitoramentoTempoHandler } from './application/event-handlers/finalizar-monitoramento-tempo.handler';
import { NotificarClienteConclusaoHandler } from './application/event-handlers/notificar-cliente-conclusao.handler';
import { AtualizarStatusEntregueHandler } from './application/event-handlers/atualizar-status-entregue.handler';
import { AtualizarStatusEncerradaSemExecucaoHandler } from './application/event-handlers/atualizar-status-encerrada-sem-execucao.handler';
import { AtualizarStatusAguardandoPecasHandler } from './application/event-handlers/atualizar-status-aguardando-pecas.handler';
import { NotificacaoClienteStub } from './infrastructure/gateways/notificacao-cliente.stub';
import { NOTIFICACAO_CLIENTE_GATEWAY } from './application/ports/notificacao-cliente.gateway';
import type { INotificacaoClienteGateway } from './application/ports/notificacao-cliente.gateway';

@Module({
  controllers: [OrdemServicoController, ServiceOrderStatusWebhookController],
  providers: [
    OrdemServicoRepository,
    OrcamentoRepository,
    OsPecaRepository,
    StatusHistoryRepository,
    StatusTransitionService,
    OsServicoRepository,
    ClienteRepository,
    VeiculoRepository,
    ServicoRepository,
    PecaInsumoRepository,
    EmissorEventos,
    OrcamentoRepository,
    OsPecaRepository,
    EmissorEventos,
    { provide: EMISSOR_EVENTOS, useClass: EmissorEventos },
    { provide: NOTIFICACAO_CLIENTE_GATEWAY, useClass: NotificacaoClienteStub },

    // Event handlers (registered as NestJS providers — @OnEvent listeners)
    {
      provide: AtualizarStatusRecebidaHandler,
      useFactory: (osRepo: OrdemServicoRepository) => new AtualizarStatusRecebidaHandler(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusEmDiagnosticoHandler,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEmDiagnosticoHandler(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: NotificarClienteDiagnosticoHandler,
      useFactory: (gateway: INotificacaoClienteGateway) =>
        new NotificarClienteDiagnosticoHandler(gateway),
      inject: [NOTIFICACAO_CLIENTE_GATEWAY],
    },
    {
      provide: GerarOrcamentoHandler,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: IEmissorEventos
      ) => new GerarOrcamentoHandler(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: EnviarOrcamentoHandler,
      useFactory: (barramento: IEmissorEventos) => new EnviarOrcamentoHandler(barramento),
      inject: [EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusAguardandoAprovacaoHandler,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new AtualizarStatusAguardandoAprovacaoHandler(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusAguardandoPecasHandler,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusAguardandoPecasHandler(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: VerificarNecessidadePecasHandler,
      useFactory: (barramento: IEmissorEventos) => new VerificarNecessidadePecasHandler(barramento),
      inject: [EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusEmExecucaoHandler,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEmExecucaoHandler(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: IniciarMonitoramentoTempoHandler,
      useFactory: (osRepo: OrdemServicoRepository) => new IniciarMonitoramentoTempoHandler(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusFinalizadaHandler,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusFinalizadaHandler(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: FinalizarMonitoramentoTempoHandler,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new FinalizarMonitoramentoTempoHandler(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: NotificarClienteConclusaoHandler,
      useFactory: (gateway: INotificacaoClienteGateway, barramento: IEmissorEventos) =>
        new NotificarClienteConclusaoHandler(gateway, barramento),
      inject: [NOTIFICACAO_CLIENTE_GATEWAY, EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusEntregueHandler,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEntregueHandler(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusEncerradaSemExecucaoHandler,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEncerradaSemExecucaoHandler(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },

    // Use Cases
    {
      provide: CriarOrdemServicoUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        clienteRepo: ClienteRepository,
        veiculoRepo: VeiculoRepository,
        servicoRepo: ServicoRepository,
        pecaRepo: PecaInsumoRepository,
        osServicoRepo: OsServicoRepository,
        osPecaRepo: OsPecaRepository,
        orcRepo: OrcamentoRepository,
        barramento: EmissorEventos
      ) =>
        new CriarOrdemServicoUseCase(
          osRepo,
          clienteRepo,
          veiculoRepo,
          servicoRepo,
          pecaRepo,
          osServicoRepo,
          osPecaRepo,
          orcRepo,
          barramento
        ),
      inject: [
        OrdemServicoRepository,
        ClienteRepository,
        VeiculoRepository,
        ServicoRepository,
        PecaInsumoRepository,
        OsServicoRepository,
        OsPecaRepository,
        OrcamentoRepository,
        EmissorEventos,
      ],
    },
    {
      provide: AssumirOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AssumirOrdemServicoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: AnalisarVeiculoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AnalisarVeiculoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: ListarServicosInsumosNaOsUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        osPecaRepo: OsPecaRepository,
        barramento: IEmissorEventos
      ) => new ListarServicosInsumosNaOsUseCase(osRepo, orcRepo, osPecaRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, OsPecaRepository, EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository) => new AtualizarOrdemServicoUseCase(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AprovarOrcamentoUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: IEmissorEventos
      ) => new AprovarOrcamentoUseCase(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: RecusarOrcamentoUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: IEmissorEventos
      ) => new RecusarOrcamentoUseCase(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: FinalizarExecucaoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new FinalizarExecucaoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: AprovarServicoPrestadoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AprovarServicoPrestadoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: RegistrarEntregaVeiculoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new RegistrarEntregaVeiculoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: ConsultarStatusOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new ConsultarStatusOrdemServicoUseCase(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: ListarOrdensServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository) => new ListarOrdensServicoUseCase(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: DetalharOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository) => new DetalharOrdemServicoUseCase(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: DeletarOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository) => new DeletarOrdemServicoUseCase(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: ConsultarTempoMedioExecucaoUseCase,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new ConsultarTempoMedioExecucaoUseCase(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: UpdateServiceOrderStatusUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        historyRepo: StatusHistoryRepository,
        barramento: IEmissorEventos,
        transitionSvc: StatusTransitionService
      ) => new UpdateServiceOrderStatusUseCase(osRepo, historyRepo, barramento, transitionSvc),
      inject: [OrdemServicoRepository, StatusHistoryRepository, EMISSOR_EVENTOS, StatusTransitionService],
    },

    // ACL Adapter for pecas-insumos
    {
      provide: ORDEM_SERVICO_BACKLOG_PORT,
      useClass: OrdemServicoBacklogAdapter,
    },
  ],
  exports: [
    OrdemServicoRepository,
    OrcamentoRepository,
    ORDEM_SERVICO_BACKLOG_PORT,
    OsServicoRepository,
  ],
})
export class OrdemServicoModule { }
