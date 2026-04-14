import { Module } from '@nestjs/common';
import { ClienteController } from './presentation/cliente.controller';
import { ClienteRepository } from './infrastructure/repositories/cliente.repository';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from './application/use-cases/cliente.use-cases';

@Module({
  controllers: [ClienteController],
  providers: [
    ClienteRepository,
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
  ],
  exports: [ClienteRepository],
})
export class ClienteModule {}
