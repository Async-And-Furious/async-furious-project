import { Module } from '@nestjs/common';
import { OrdemServicoController } from './presentation/controllers/ordem-servico.controller';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { OrcamentoRepository } from './infrastructure/repositories/orcamento.repository';
import { BarramentoEventos } from '../../shared/infrastructure/barramento-eventos/barramento-eventos.service';
import {
  CriarOrdemServicoUseCase,
  AssumirOrdemServicoUseCase,
  AnalisarVeiculoUseCase,
  ListarServicosInsumosNaOsUseCase,
  FinalizarExecucaoUseCase,
  AprovarServicoPrestadoUseCase,
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

@Module({
  controllers: [OrdemServicoController],
  providers: [
    OrdemServicoRepository,
    OrcamentoRepository,
    BarramentoEventos,

    // Policies (registered as NestJS providers — @OnEvent listeners)
    {
      provide: AtualizarStatusRecebidaPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new AtualizarStatusRecebidaPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusEmDiagnosticoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AtualizarStatusEmDiagnosticoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
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
        barramento: BarramentoEventos,
      ) => new GerarOrcamentoPolicy(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, BarramentoEventos],
    },
    {
      provide: EnviarOrcamentoPolicy,
      useFactory: (barramento: BarramentoEventos) => new EnviarOrcamentoPolicy(barramento),
      inject: [BarramentoEventos],
    },
    {
      provide: AtualizarStatusAguardandoAprovacaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new AtualizarStatusAguardandoAprovacaoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: VerificarNecessidadePecasPolicy,
      useFactory: (barramento: BarramentoEventos) => new VerificarNecessidadePecasPolicy(barramento),
      inject: [BarramentoEventos],
    },
    {
      provide: AtualizarStatusEmExecucaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AtualizarStatusEmExecucaoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },
    {
      provide: IniciarMonitoramentoTempoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new IniciarMonitoramentoTempoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusFinalizadaPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AtualizarStatusFinalizadaPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },
    {
      provide: FinalizarMonitoramentoTempoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new FinalizarMonitoramentoTempoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: NotificarClienteConclusaoPolicy,
      useFactory: (barramento: BarramentoEventos) =>
        new NotificarClienteConclusaoPolicy(barramento),
      inject: [BarramentoEventos],
    },
    {
      provide: AtualizarStatusEntreguePolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AtualizarStatusEntreguePolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },
    {
      provide: AtualizarStatusEncerradaSemExecucaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AtualizarStatusEncerradaSemExecucaoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },

    // Use Cases
    {
      provide: CriarOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new CriarOrdemServicoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },
    {
      provide: AssumirOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AssumirOrdemServicoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },
    {
      provide: AnalisarVeiculoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AnalisarVeiculoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },
    {
      provide: ListarServicosInsumosNaOsUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: BarramentoEventos,
      ) => new ListarServicosInsumosNaOsUseCase(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, BarramentoEventos],
    },
    {
      provide: AprovarOrcamentoUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: BarramentoEventos,
      ) => new AprovarOrcamentoUseCase(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, BarramentoEventos],
    },
    {
      provide: RecusarOrcamentoUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: BarramentoEventos,
      ) => new RecusarOrcamentoUseCase(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, BarramentoEventos],
    },
    {
      provide: FinalizarExecucaoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new FinalizarExecucaoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
    },
    {
      provide: AprovarServicoPrestadoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: BarramentoEventos) =>
        new AprovarServicoPrestadoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, BarramentoEventos],
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
  ],
  exports: [OrdemServicoRepository, OrcamentoRepository],
})
export class OrdemServicoModule {}
