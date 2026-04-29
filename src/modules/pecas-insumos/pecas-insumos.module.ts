import { Module } from '@nestjs/common';
import { PecaInsumoController } from './presentation/controllers/peca-insumo.controller';
import { PecaInsumoRepository } from './infrastructure/repositories/peca-insumo.repository';
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

@Module({
  controllers: [PecaInsumoController],
  providers: [
    PecaInsumoRepository,
    EmissorEventos,
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
