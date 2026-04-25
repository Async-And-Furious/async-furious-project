import { Module } from '@nestjs/common';
import { ClienteController } from './presentation/controllers/cliente.controller';
import { VeiculoController } from './presentation/controllers/veiculo.controller';
import { ServicoController } from './presentation/controllers/servico.controller';
import { ClienteRepository } from './infrastructure/repositories/cliente.repository';
import { VeiculoRepository } from './infrastructure/repositories/veiculo.repository';
import { ServicoRepository } from './infrastructure/repositories/servico.repository';
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
import {
  CreateServicoUseCase,
  ListServicosUseCase,
  GetServicoUseCase,
  UpdateServicoUseCase,
  DeleteServicoUseCase,
} from './application/use-cases/servico.use-cases';

@Module({
  controllers: [ClienteController, VeiculoController, ServicoController],
  providers: [
    ClienteRepository,
    VeiculoRepository,
    ServicoRepository,
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
    {
      provide: CreateServicoUseCase,
      useFactory: (repo: ServicoRepository) => new CreateServicoUseCase(repo),
      inject: [ServicoRepository],
    },
    {
      provide: ListServicosUseCase,
      useFactory: (repo: ServicoRepository) => new ListServicosUseCase(repo),
      inject: [ServicoRepository],
    },
    {
      provide: GetServicoUseCase,
      useFactory: (repo: ServicoRepository) => new GetServicoUseCase(repo),
      inject: [ServicoRepository],
    },
    {
      provide: UpdateServicoUseCase,
      useFactory: (repo: ServicoRepository) => new UpdateServicoUseCase(repo),
      inject: [ServicoRepository],
    },
    {
      provide: DeleteServicoUseCase,
      useFactory: (repo: ServicoRepository) => new DeleteServicoUseCase(repo),
      inject: [ServicoRepository],
    },
  ],
  exports: [ClienteRepository, VeiculoRepository, ServicoRepository],
})
export class CadastroModule {}
