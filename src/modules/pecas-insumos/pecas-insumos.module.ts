import { Module } from '@nestjs/common';
import { PecaInsumoController } from './presentation/controllers/peca-insumo.controller';
import { PecaInsumoRepository } from './infrastructure/repositories/peca-insumo.repository';
import { PedidoFornecedorRepository } from './infrastructure/repositories/pedido-fornecedor.repository';
import { ReservaEstoqueRepository } from './infrastructure/repositories/reserva-estoque.repository';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import {
  CreatePecaInsumoUseCase,
  ListPecasInsumoUseCase,
  GetPecaInsumoUseCase,
  UpdatePecaInsumoUseCase,
  UpdateEstoquePecaInsumoUseCase,
  DeletePecaInsumoUseCase,
} from './application/use-cases/peca-insumo.use-cases';
import { VerificarDisponibilidadeEstoquePolicy } from './application/policies/verificar-disponibilidade-estoque.policy';
import { DebitarEstoquePolicy } from './application/policies/debitar-estoque.policy';
import { NotificarPecasIndisponiveisPolicy } from './application/policies/notificar-pecas-indisponiveis.policy';
import { NotificarAdminReposicaoPolicy } from './application/policies/notificar-admin-reposicao.policy';
import { SolicitarPecasFornecedorPolicy } from './application/policies/solicitar-pecas-fornecedor.policy';
import { ReceberPecasFornecedorPolicy } from './application/policies/receber-pecas-fornecedor.policy';
import { ValidarBacklogOrdensPendentesPolicy } from './application/policies/validar-backlog-ordens-pendentes.policy';
import { LiberarOrdensAguardandoPecasPolicy } from './application/policies/liberar-ordens-aguardando-pecas.policy';
import { OrdemServicoModule } from '../ordem-servico/ordem-servico.module';
import {
  ORDEM_SERVICO_BACKLOG_PORT,
  IOrdemServicoBacklogPort,
} from '../../shared/domain/interfaces/ordem-servico-backlog.port';

@Module({
  imports: [OrdemServicoModule],
  controllers: [PecaInsumoController],
  providers: [
    PecaInsumoRepository,
    PedidoFornecedorRepository,
    ReservaEstoqueRepository,
    EmissorEventos,

    // P-18 → P-21 policies
    {
      provide: VerificarDisponibilidadeEstoquePolicy,
      useFactory: (repo: PecaInsumoRepository, emissor: EmissorEventos) =>
        new VerificarDisponibilidadeEstoquePolicy(repo, emissor),
      inject: [PecaInsumoRepository, EmissorEventos],
    },
    {
      provide: DebitarEstoquePolicy,
      useFactory: (repo: PecaInsumoRepository, emissor: EmissorEventos) =>
        new DebitarEstoquePolicy(repo, emissor),
      inject: [PecaInsumoRepository, EmissorEventos],
    },
    {
      provide: NotificarPecasIndisponiveisPolicy,
      useFactory: (emissor: EmissorEventos) => new NotificarPecasIndisponiveisPolicy(emissor),
      inject: [EmissorEventos],
    },
    {
      provide: NotificarAdminReposicaoPolicy,
      useFactory: () => new NotificarAdminReposicaoPolicy(),
      inject: [],
    },

    // P-22 → P-25 policies
    {
      provide: SolicitarPecasFornecedorPolicy,
      useFactory: (
        pecaRepo: PecaInsumoRepository,
        pedidoRepo: PedidoFornecedorRepository,
        emissor: EmissorEventos
      ) => new SolicitarPecasFornecedorPolicy(pecaRepo, pedidoRepo, emissor),
      inject: [PecaInsumoRepository, PedidoFornecedorRepository, EmissorEventos],
    },
    {
      provide: ReceberPecasFornecedorPolicy,
      useFactory: (
        pecaRepo: PecaInsumoRepository,
        pedidoRepo: PedidoFornecedorRepository,
        emissor: EmissorEventos
      ) => new ReceberPecasFornecedorPolicy(pecaRepo, pedidoRepo, emissor),
      inject: [PecaInsumoRepository, PedidoFornecedorRepository, EmissorEventos],
    },
    {
      provide: ValidarBacklogOrdensPendentesPolicy,
      useFactory: (
        backlogPort: IOrdemServicoBacklogPort,
        pecaRepo: PecaInsumoRepository,
        emissor: EmissorEventos
      ) => new ValidarBacklogOrdensPendentesPolicy(backlogPort, pecaRepo, emissor),
      inject: [ORDEM_SERVICO_BACKLOG_PORT, PecaInsumoRepository, EmissorEventos],
    },
    {
      provide: LiberarOrdensAguardandoPecasPolicy,
      useFactory: (
        pecaRepo: PecaInsumoRepository,
        reservaRepo: ReservaEstoqueRepository,
        emissor: EmissorEventos
      ) => new LiberarOrdensAguardandoPecasPolicy(pecaRepo, reservaRepo, emissor),
      inject: [PecaInsumoRepository, ReservaEstoqueRepository, EmissorEventos],
    },

    // Use cases
    {
      provide: CreatePecaInsumoUseCase,
      useFactory: (repo: PecaInsumoRepository) => new CreatePecaInsumoUseCase(repo),
      inject: [PecaInsumoRepository],
    },
    {
      provide: ListPecasInsumoUseCase,
      useFactory: (repo: PecaInsumoRepository) => new ListPecasInsumoUseCase(repo),
      inject: [PecaInsumoRepository],
    },
    {
      provide: GetPecaInsumoUseCase,
      useFactory: (repo: PecaInsumoRepository) => new GetPecaInsumoUseCase(repo),
      inject: [PecaInsumoRepository],
    },
    {
      provide: UpdatePecaInsumoUseCase,
      useFactory: (repo: PecaInsumoRepository) => new UpdatePecaInsumoUseCase(repo),
      inject: [PecaInsumoRepository],
    },
    {
      provide: UpdateEstoquePecaInsumoUseCase,
      useFactory: (repo: PecaInsumoRepository) => new UpdateEstoquePecaInsumoUseCase(repo),
      inject: [PecaInsumoRepository],
    },
    {
      provide: DeletePecaInsumoUseCase,
      useFactory: (repo: PecaInsumoRepository) => new DeletePecaInsumoUseCase(repo),
      inject: [PecaInsumoRepository],
    },
  ],
  exports: [PecaInsumoRepository],
})
export class PecasInsumosModule {}
