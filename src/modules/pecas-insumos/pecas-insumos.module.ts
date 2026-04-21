import { Module } from '@nestjs/common';
import { PecaInsumoController } from './presentation/controllers/peca-insumo.controller';
import { PecaInsumoRepository } from './infrastructure/repositories/peca-insumo.repository';
import {
  CreatePecaInsumoUseCase,
  ListPecasInsumoUseCase,
  GetPecaInsumoUseCase,
  UpdatePecaInsumoUseCase,
  UpdateEstoquePecaInsumoUseCase,
  DeletePecaInsumoUseCase,
} from './application/use-cases/peca-insumo.use-cases';

@Module({
  controllers: [PecaInsumoController],
  providers: [
    PecaInsumoRepository,
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
