import { Module } from '@nestjs/common';
import { OrdemServicoController } from './presentation/controllers/ordem-servico.controller';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { OrcamentoRepository } from './infrastructure/repositories/orcamento.repository';
import { OsPecaRepository } from './infrastructure/repositories/os-peca.repository';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
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

@Module({
  controllers: [OrdemServicoController],
  providers: [
    OrdemServicoRepository,
    OrcamentoRepository,
    OsPecaRepository,
    EmissorEventos,
    { provide: EMISSOR_EVENTOS, useClass: EmissorEventos },

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
      useFactory: () => new NotificarClienteDiagnosticoHandler(),
      inject: [],
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
      useFactory: (barramento: IEmissorEventos) => new NotificarClienteConclusaoHandler(barramento),
      inject: [EMISSOR_EVENTOS],
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
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new CriarOrdemServicoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
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

    // ACL Adapter for pecas-insumos
    {
      provide: ORDEM_SERVICO_BACKLOG_PORT,
      useClass: OrdemServicoBacklogAdapter,
    },
  ],
  exports: [OrdemServicoRepository, OrcamentoRepository, ORDEM_SERVICO_BACKLOG_PORT],
})
export class OrdemServicoModule {}
