import { Module } from '@nestjs/common';
import { VeiculoController } from './presentation/controllers/veiculo.controller';
import { VeiculoRepository } from './infrastructure/repositories/veiculo.repository';
import {
  CreateVeiculoUseCase,
  ListVeiculosUseCase,
  GetVeiculoUseCase,
  UpdateVeiculoUseCase,
  DeleteVeiculoUseCase,
} from './application/use-cases/veiculo.use-cases';

@Module({
  controllers: [VeiculoController],
  providers: [
    VeiculoRepository,
    CreateVeiculoUseCase,
    ListVeiculosUseCase,
    GetVeiculoUseCase,
    UpdateVeiculoUseCase,
    DeleteVeiculoUseCase,
  ],
  exports: [VeiculoRepository],
})
export class VeiculoModule {}
