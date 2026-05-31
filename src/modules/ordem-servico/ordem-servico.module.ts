import { Module } from '@nestjs/common';
import { OrdemServicoController } from './presentation/controllers/ordem-servico.controller';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { OrcamentoRepository } from './infrastructure/repositories/orcamento.repository';
import { OsPecaRepository } from './infrastructure/repositories/os-peca.repository';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { EMISSOR_EVENTOS, IEmissorEventos } from '../../shared/domain/interfaces/emissor-eventos.interface';
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
// Policies
import { AtualizarStatusRecebidaPolicy } from './application/policies/atualizar-status-recebida.policy';
import { AtualizarStatusEmDiagnosticoPolicy } from './application/policies/atualizar-status-em-diagnostico.policy';
import { NotificarClienteDiagnosticoPolicy } from './application/policies/notificar-cliente-diagnostico.policy';
import { GerarOrcamentoPolicy } from './application/policies/gerar-orcamento.policy';
import { EnviarOrcamentoPolicy } from './application/policies/enviar-orcamento.policy';
import { AtualizarStatusAguardandoAprovacaoPolicy } from './application/policies/atualizar-status-aguardando-aprovacao.policy';
import { VerificarNecessidadePecasPolicy } from './application/policies/verificar-necessidade-pecas.policy';
import { AtualizarStatusEmExecucaoPolicy } from './application/policies/atualizar-status-em-execucao.policy';
import { IniciarMonitoramentoTempoPolicy } from './application/policies/iniciar-monitoramento-tempo.policy';
import { AtualizarStatusFinalizadaPolicy } from './application/policies/atualizar-status-finalizada.policy';
import { FinalizarMonitoramentoTempoPolicy } from './application/policies/finalizar-monitoramento-tempo.policy';
import { NotificarClienteConclusaoPolicy } from './application/policies/notificar-cliente-conclusao.policy';
import { AtualizarStatusEntreguePolicy } from './application/policies/atualizar-status-entregue.policy';
import { AtualizarStatusEncerradaSemExecucaoPolicy } from './application/policies/atualizar-status-encerrada-sem-execucao.policy';
import { AtualizarStatusAguardandoPecasPolicy } from './application/policies/atualizar-status-aguardando-pecas.policy';

@Module({
  controllers: [OrdemServicoController],
  providers: [
    OrdemServicoRepository,
    OrcamentoRepository,
    OsPecaRepository,
    EmissorEventos,
    { provide: EMISSOR_EVENTOS, useClass: EmissorEventos },

    // Policies (registered as NestJS providers — @OnEvent listeners)
    {
      provide: AtualizarStatusRecebidaPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new AtualizarStatusRecebidaPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusEmDiagnosticoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEmDiagnosticoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: NotificarClienteDiagnosticoPolicy,
      useFactory: () => new NotificarClienteDiagnosticoPolicy(),
      inject: [],
    },
    {
      provide: GerarOrcamentoPolicy,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: IEmissorEventos
      ) => new GerarOrcamentoPolicy(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: EnviarOrcamentoPolicy,
      useFactory: (barramento: IEmissorEventos) => new EnviarOrcamentoPolicy(barramento),
      inject: [EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusAguardandoAprovacaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new AtualizarStatusAguardandoAprovacaoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusAguardandoPecasPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusAguardandoPecasPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: VerificarNecessidadePecasPolicy,
      useFactory: (barramento: IEmissorEventos) => new VerificarNecessidadePecasPolicy(barramento),
      inject: [EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusEmExecucaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEmExecucaoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: IniciarMonitoramentoTempoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new IniciarMonitoramentoTempoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusFinalizadaPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusFinalizadaPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: FinalizarMonitoramentoTempoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new FinalizarMonitoramentoTempoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: NotificarClienteConclusaoPolicy,
      useFactory: (barramento: IEmissorEventos) => new NotificarClienteConclusaoPolicy(barramento),
      inject: [EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusEntreguePolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEntreguePolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: AtualizarStatusEncerradaSemExecucaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: IEmissorEventos) =>
        new AtualizarStatusEncerradaSemExecucaoPolicy(osRepo, barramento),
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

    // ACL Adapter for pecas-insumos
    {
      provide: ORDEM_SERVICO_BACKLOG_PORT,
      useClass: OrdemServicoBacklogAdapter,
    },
  ],
  exports: [OrdemServicoRepository, OrcamentoRepository, ORDEM_SERVICO_BACKLOG_PORT],
})
export class OrdemServicoModule {}
