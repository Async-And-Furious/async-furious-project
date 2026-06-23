import { Module } from '@nestjs/common';
import { PecaInsumoController } from './presentation/controllers/peca-insumo.controller';
import { PecaInsumoRepository } from './infrastructure/repositories/peca-insumo.repository';
import { PedidoFornecedorRepository } from './infrastructure/repositories/pedido-fornecedor.repository';
import { ReservaEstoqueRepository } from './infrastructure/repositories/reserva-estoque.repository';
import { EmissorEventos } from '../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import {
  EMISSOR_EVENTOS,
  IEmissorEventos,
} from '../../shared/domain/interfaces/emissor-eventos.interface';
import {
  CreatePecaInsumoUseCase,
  ListPecasInsumoUseCase,
  GetPecaInsumoUseCase,
  UpdatePecaInsumoUseCase,
  UpdateEstoquePecaInsumoUseCase,
  DeletePecaInsumoUseCase,
} from './application/use-cases/peca-insumo.use-cases';
import { VerificarDisponibilidadeEstoqueHandler } from './application/event-handlers/verificar-disponibilidade-estoque.handler';
import { DebitarEstoqueHandler } from './application/event-handlers/debitar-estoque.handler';
import { NotificarPecasIndisponiveisHandler } from './application/event-handlers/notificar-pecas-indisponiveis.handler';
import { NotificarAdminReposicaoHandler } from './application/event-handlers/notificar-admin-reposicao.handler';
import { NotificacaoAdminStub } from './infrastructure/gateways/notificacao-admin.stub';
import {
  NOTIFICACAO_ADMIN_GATEWAY,
  INotificacaoAdminGateway,
} from './application/ports/notificacao-admin.gateway';
import { FornecedorStub } from './infrastructure/gateways/fornecedor.stub';
import { FORNECEDOR_GATEWAY, IFornecedorGateway } from './application/ports/fornecedor.gateway';
import {
  SolicitarPecasAoFornecedorUseCase,
  ReceberPecasDoFornecedorUseCase,
} from './application/use-cases/fornecedor.use-cases';
import { ValidarBacklogOrdensPendentesHandler } from './application/event-handlers/validar-backlog-ordens-pendentes.handler';
import { LiberarOrdensAguardandoPecasHandler } from './application/event-handlers/liberar-ordens-aguardando-pecas.handler';
import { OrdemServicoModule } from '../ordem-servico/ordem-servico.module';
import {
  ORDEM_SERVICO_BACKLOG_PORT,
  IOrdemServicoBacklogPort,
} from '../../shared/domain/interfaces/ordem-servico-backlog.port';

@Module({
  imports: [OrdemServicoModule],
  controllers: [PecaInsumoController],
  providers: [
    PecaInsumoRepository,
    PedidoFornecedorRepository,
    ReservaEstoqueRepository,
    EmissorEventos,
    { provide: EMISSOR_EVENTOS, useClass: EmissorEventos },
    { provide: NOTIFICACAO_ADMIN_GATEWAY, useClass: NotificacaoAdminStub },
    { provide: FORNECEDOR_GATEWAY, useClass: FornecedorStub },

    // P-18 → P-21 event handlers
    {
      provide: VerificarDisponibilidadeEstoqueHandler,
      useFactory: (repo: PecaInsumoRepository, emissor: IEmissorEventos) =>
        new VerificarDisponibilidadeEstoqueHandler(repo, emissor),
      inject: [PecaInsumoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: DebitarEstoqueHandler,
      useFactory: (repo: PecaInsumoRepository, emissor: IEmissorEventos) =>
        new DebitarEstoqueHandler(repo, emissor),
      inject: [PecaInsumoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: NotificarPecasIndisponiveisHandler,
      useFactory: (emissor: IEmissorEventos) => new NotificarPecasIndisponiveisHandler(emissor),
      inject: [EMISSOR_EVENTOS],
    },
    {
      provide: NotificarAdminReposicaoHandler,
      useFactory: (gateway: INotificacaoAdminGateway) =>
        new NotificarAdminReposicaoHandler(gateway),
      inject: [NOTIFICACAO_ADMIN_GATEWAY],
    },

    // P-22 → P-25 event handlers
    {
      provide: ValidarBacklogOrdensPendentesHandler,
      useFactory: (
        backlogPort: IOrdemServicoBacklogPort,
        pecaRepo: PecaInsumoRepository,
        emissor: IEmissorEventos
      ) => new ValidarBacklogOrdensPendentesHandler(backlogPort, pecaRepo, emissor),
      inject: [ORDEM_SERVICO_BACKLOG_PORT, PecaInsumoRepository, EMISSOR_EVENTOS],
    },
    {
      provide: LiberarOrdensAguardandoPecasHandler,
      useFactory: (
        pecaRepo: PecaInsumoRepository,
        reservaRepo: ReservaEstoqueRepository,
        emissor: IEmissorEventos
      ) => new LiberarOrdensAguardandoPecasHandler(pecaRepo, reservaRepo, emissor),
      inject: [PecaInsumoRepository, ReservaEstoqueRepository, EMISSOR_EVENTOS],
    },

    // Use cases
    // P-22: Solicitar peças ao fornecedor
    {
      provide: SolicitarPecasAoFornecedorUseCase,
      useFactory: (
        pecaRepo: PecaInsumoRepository,
        pedidoRepo: PedidoFornecedorRepository,
        emissor: IEmissorEventos,
        fornecedorGateway: IFornecedorGateway
      ) => new SolicitarPecasAoFornecedorUseCase(pecaRepo, pedidoRepo, emissor, fornecedorGateway),
      inject: [
        PecaInsumoRepository,
        PedidoFornecedorRepository,
        EMISSOR_EVENTOS,
        FORNECEDOR_GATEWAY,
      ],
    },
    // P-23: Receber peças do fornecedor
    {
      provide: ReceberPecasDoFornecedorUseCase,
      useFactory: (
        pecaRepo: PecaInsumoRepository,
        pedidoRepo: PedidoFornecedorRepository,
        emissor: IEmissorEventos
      ) => new ReceberPecasDoFornecedorUseCase(pecaRepo, pedidoRepo, emissor),
      inject: [PecaInsumoRepository, PedidoFornecedorRepository, EMISSOR_EVENTOS],
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
