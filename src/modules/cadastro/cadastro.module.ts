import { Module } from '@nestjs/common';
import { ClienteController } from './presentation/controllers/cliente.controller';
import { VeiculoController } from './presentation/controllers/veiculo.controller';
import { ClienteRepository } from './infrastructure/repositories/cliente.repository';
import { VeiculoRepository } from './infrastructure/repositories/veiculo.repository';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from './application/use-cases/cliente.use-cases';
import {
  CreateVeiculoUseCase,
  ListVeiculosUseCase,
  GetVeiculoUseCase,
  UpdateVeiculoUseCase,
  DeleteVeiculoUseCase,
} from './application/use-cases/veiculo.use-cases';

@Module({
  controllers: [ClienteController, VeiculoController],
  providers: [
    ClienteRepository,
    VeiculoRepository,
    {
      provide: CreateClienteUseCase,
      useFactory: (repo: ClienteRepository) => new CreateClienteUseCase(repo),
      inject: [ClienteRepository],
    },
    {
      provide: ListClientesUseCase,
      useFactory: (repo: ClienteRepository) => new ListClientesUseCase(repo),
      inject: [ClienteRepository],
    },
    {
      provide: GetClienteUseCase,
      useFactory: (repo: ClienteRepository) => new GetClienteUseCase(repo),
      inject: [ClienteRepository],
    },
    {
      provide: UpdateClienteUseCase,
      useFactory: (repo: ClienteRepository) => new UpdateClienteUseCase(repo),
      inject: [ClienteRepository],
    },
    {
      provide: DeleteClienteUseCase,
      useFactory: (repo: ClienteRepository) => new DeleteClienteUseCase(repo),
      inject: [ClienteRepository],
    },
    {
      provide: CreateVeiculoUseCase,
      useFactory: (repo: VeiculoRepository) => new CreateVeiculoUseCase(repo),
      inject: [VeiculoRepository],
    },
    {
      provide: ListVeiculosUseCase,
      useFactory: (repo: VeiculoRepository) => new ListVeiculosUseCase(repo),
      inject: [VeiculoRepository],
    },
    {
      provide: GetVeiculoUseCase,
      useFactory: (repo: VeiculoRepository) => new GetVeiculoUseCase(repo),
      inject: [VeiculoRepository],
    },
    {
      provide: UpdateVeiculoUseCase,
      useFactory: (repo: VeiculoRepository) => new UpdateVeiculoUseCase(repo),
      inject: [VeiculoRepository],
    },
    {
      provide: DeleteVeiculoUseCase,
      useFactory: (repo: VeiculoRepository) => new DeleteVeiculoUseCase(repo),
      inject: [VeiculoRepository],
    },
  ],
  exports: [ClienteRepository, VeiculoRepository],
})
export class CadastroModule {}
