import { Module } from '@nestjs/common';
import { OrdemServicoController } from './presentation/controllers/ordem-servico.controller';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import {
  CreateOrdemServicoUseCase,
  ListOrdensServicoUseCase,
  GetOrdemServicoUseCase,
  UpdateOrdemServicoUseCase,
  DeleteOrdemServicoUseCase,
} from './application/use-cases/ordem-servico.use-cases';

@Module({
  controllers: [OrdemServicoController],
  providers: [
    OrdemServicoRepository,
    {
      provide: CreateOrdemServicoUseCase,
      useFactory: (repo: OrdemServicoRepository) => new CreateOrdemServicoUseCase(repo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: ListOrdensServicoUseCase,
      useFactory: (repo: OrdemServicoRepository) => new ListOrdensServicoUseCase(repo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: GetOrdemServicoUseCase,
      useFactory: (repo: OrdemServicoRepository) => new GetOrdemServicoUseCase(repo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: UpdateOrdemServicoUseCase,
      useFactory: (repo: OrdemServicoRepository) => new UpdateOrdemServicoUseCase(repo),
      inject: [OrdemServicoRepository],
    },
    {
      provide: DeleteOrdemServicoUseCase,
      useFactory: (repo: OrdemServicoRepository) => new DeleteOrdemServicoUseCase(repo),
      inject: [OrdemServicoRepository],
    },
  ],
  exports: [OrdemServicoRepository],
})
export class OrdemServicoModule {}
