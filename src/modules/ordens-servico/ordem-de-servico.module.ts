import { Module } from '@nestjs/common';
import { OrdemDeServicoController } from './presentation/controllers/ordem-de-servico.controller';
import { OrdemDeServicoRepository } from './infrastructure/repositories/ordem-de-servico.repository';
import {
  CreateOrdemDeServicoUseCase,
  ListOrdensDeServicoUseCase,
  GetOrdemDeServicoUseCase,
  UpdateOrdemDeServicoUseCase,
  DeleteOrdemDeServicoUseCase,
} from './application/use-cases/ordem-de-servico.use-cases';

@Module({
  controllers: [OrdemDeServicoController],
  providers: [
    OrdemDeServicoRepository,
    CreateOrdemDeServicoUseCase,
    ListOrdensDeServicoUseCase,
    GetOrdemDeServicoUseCase,
    UpdateOrdemDeServicoUseCase,
    DeleteOrdemDeServicoUseCase,
  ],
  exports: [OrdemDeServicoRepository],
})
export class OrdemDeServicoModule {}
