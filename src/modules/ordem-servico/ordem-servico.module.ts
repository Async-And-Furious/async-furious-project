import { Module } from '@nestjs/common';
import { OrdemServicoController } from './presentation/controllers/ordem-servico.controller';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { OrcamentoRepository } from './infrastructure/repositories/orcamento.repository';
import { OsPecaRepository } from './infrastructure/repositories/os-peca.repository';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
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
import { AtualizarStatusAguardandoPecasPolicy } from './application/policies/atualizar-status-aguardando-pecas.policy';

@Module({
  controllers: [OrdemServicoController],
  providers: [
    OrdemServicoRepository,
    OrcamentoRepository,
    OsPecaRepository,
    EmissorEventos,

    // Policies (registered as NestJS providers — @OnEvent listeners)
    {
      provide: AtualizarStatusRecebidaPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new AtualizarStatusRecebidaPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusEmDiagnosticoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AtualizarStatusEmDiagnosticoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
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
        barramento: EmissorEventos
      ) => new GerarOrcamentoPolicy(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, EmissorEventos],
    },
    {
      provide: EnviarOrcamentoPolicy,
      useFactory: (barramento: EmissorEventos) => new EnviarOrcamentoPolicy(barramento),
      inject: [EmissorEventos],
    },
    {
      provide: AtualizarStatusAguardandoAprovacaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) =>
        new AtualizarStatusAguardandoAprovacaoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusAguardandoPecasPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AtualizarStatusAguardandoPecasPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: VerificarNecessidadePecasPolicy,
      useFactory: (barramento: EmissorEventos) => new VerificarNecessidadePecasPolicy(barramento),
      inject: [EmissorEventos],
    },
    {
      provide: AtualizarStatusEmExecucaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AtualizarStatusEmExecucaoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: IniciarMonitoramentoTempoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new IniciarMonitoramentoTempoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: AtualizarStatusFinalizadaPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AtualizarStatusFinalizadaPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: FinalizarMonitoramentoTempoPolicy,
      useFactory: (osRepo: OrdemServicoRepository) => new FinalizarMonitoramentoTempoPolicy(osRepo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: NotificarClienteConclusaoPolicy,
      useFactory: (barramento: EmissorEventos) => new NotificarClienteConclusaoPolicy(barramento),
      inject: [EmissorEventos],
    },
    {
      provide: AtualizarStatusEntreguePolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AtualizarStatusEntreguePolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: AtualizarStatusEncerradaSemExecucaoPolicy,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AtualizarStatusEncerradaSemExecucaoPolicy(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },

    // Use Cases
    {
      provide: CriarOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new CriarOrdemServicoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: AssumirOrdemServicoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AssumirOrdemServicoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: AnalisarVeiculoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AnalisarVeiculoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: ListarServicosInsumosNaOsUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        osPecaRepo: OsPecaRepository,
        barramento: EmissorEventos
      ) => new ListarServicosInsumosNaOsUseCase(osRepo, orcRepo, osPecaRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, OsPecaRepository, EmissorEventos],
    },
    {
      provide: AprovarOrcamentoUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: EmissorEventos
      ) => new AprovarOrcamentoUseCase(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, EmissorEventos],
    },
    {
      provide: RecusarOrcamentoUseCase,
      useFactory: (
        osRepo: OrdemServicoRepository,
        orcRepo: OrcamentoRepository,
        barramento: EmissorEventos
      ) => new RecusarOrcamentoUseCase(osRepo, orcRepo, barramento),
      inject: [OrdemServicoRepository, OrcamentoRepository, EmissorEventos],
    },
    {
      provide: FinalizarExecucaoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new FinalizarExecucaoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
    },
    {
      provide: AprovarServicoPrestadoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, barramento: EmissorEventos) =>
        new AprovarServicoPrestadoUseCase(osRepo, barramento),
      inject: [OrdemServicoRepository, EmissorEventos],
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
