import { Module } from '@nestjs/common';
import { PecaController } from './presentation/peca.controller';
import { PecaRepository } from './infrastructure/repositories/peca.repository';
import {
  CreatePecaUseCase,
  ListPecasUseCase,
  GetPecaUseCase,
  UpdatePecaUseCase,
  UpdateEstoquePecaUseCase,
  DeletePecaUseCase,
} from './application/use-cases/peca.use-cases';

@Module({
  controllers: [PecaController],
  providers: [
    PecaRepository,
    {
      provide: CreatePecaUseCase,
      useFactory: (repo: PecaRepository) => new CreatePecaUseCase(repo),
      inject: [PecaRepository],
    },
    {
      provide: ListPecasUseCase,
      useFactory: (repo: PecaRepository) => new ListPecasUseCase(repo),
      inject: [PecaRepository],
    },
    {
      provide: GetPecaUseCase,
      useFactory: (repo: PecaRepository) => new GetPecaUseCase(repo),
      inject: [PecaRepository],
    },
    {
      provide: UpdatePecaUseCase,
      useFactory: (repo: PecaRepository) => new UpdatePecaUseCase(repo),
      inject: [PecaRepository],
    },
    {
      provide: UpdateEstoquePecaUseCase,
      useFactory: (repo: PecaRepository) => new UpdateEstoquePecaUseCase(repo),
      inject: [PecaRepository],
    },
    {
      provide: DeletePecaUseCase,
      useFactory: (repo: PecaRepository) => new DeletePecaUseCase(repo),
      inject: [PecaRepository],
    },
  ],
  exports: [PecaRepository],
})
export class PecaModule {}
