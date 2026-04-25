import { Module } from '@nestjs/common';
import { OrdemServicoController } from './presentation/controllers/ordem-servico.controller';
import { OrdemServicoRepository } from './infrastructure/repositories/ordem-servico.repository';
import { OrcamentoRepository } from './infrastructure/repositories/orcamento.repository';
import {
  CreateOrdemServicoUseCase,
  ListOrdensServicoUseCase,
  GetOrdemServicoUseCase,
  UpdateOrdemServicoUseCase,
  DeleteOrdemServicoUseCase,
} from './application/use-cases/ordem-servico.use-cases';
import {
  GerarOrcamentoUseCase,
  AprovarOrcamentoUseCase,
  RejeitarOrcamentoUseCase,
} from './application/use-cases/orcamento.use-cases';

@Module({
  controllers: [OrdemServicoController],
  providers: [
    OrdemServicoRepository,
    OrcamentoRepository,
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
    {
      provide: GerarOrcamentoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, orcRepo: OrcamentoRepository) =>
        new GerarOrcamentoUseCase(osRepo, orcRepo),
      inject: [OrdemServicoRepository, OrcamentoRepository],
    },
    {
      provide: AprovarOrcamentoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, orcRepo: OrcamentoRepository) =>
        new AprovarOrcamentoUseCase(osRepo, orcRepo),
      inject: [OrdemServicoRepository, OrcamentoRepository],
    },
    {
      provide: RejeitarOrcamentoUseCase,
      useFactory: (osRepo: OrdemServicoRepository, orcRepo: OrcamentoRepository) =>
        new RejeitarOrcamentoUseCase(osRepo, orcRepo),
      inject: [OrdemServicoRepository, OrcamentoRepository],
    },
  ],
  exports: [OrdemServicoRepository, OrcamentoRepository],
})
export class OrdemServicoModule {}
