import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import type { Orcamento } from '../../domain/entities/orcamento.entity';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { IOrcamentoRepository } from '../../domain/interfaces/orcamento.interface';
import type { IOsPecaRepository } from '../../domain/interfaces/os-peca.interface';
import { OrdemServicoCriada } from '../../domain/events/ordem-servico-criada.event';
import { OrdemServicoAssumida } from '../../domain/events/ordem-servico-assumida.event';
import { VeiculoAnalisado } from '../../domain/events/veiculo-analisado.event';
import { ServicosEInsumosListados } from '../../domain/events/servicos-e-insumos-listados.event';
import { ServicoConcluidoPeloMecanico } from '../../domain/events/servico-concluido-pelo-mecanico.event';
import { ServicoAprovadoPeloCliente } from '../../domain/events/servico-aprovado-pelo-cliente.event';
import { PagamentoRegistrado } from '../../domain/events/pagamento-registrado.event';

// UC-01
export class CriarOrdemServicoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(data: {
    veiculoId: string;
    clienteId: string;
    descricao?: string;
  }): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.create(data);
    await this.emissor.emitir(new OrdemServicoCriada(os.id, os.clienteId, os.veiculoId));
    return this.ordemServicoRepository.findOne(os.id);
  }
}

// UC-02
export class AssumirOrdemServicoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeAssumir();
    await this.emissor.emitir(new OrdemServicoAssumida(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-03
export class AnalisarVeiculoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeAnalisarVeiculo();
    await this.emissor.emitir(new VeiculoAnalisado(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-04
export class ListarServicosInsumosNaOsUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly orcamentoRepository: IOrcamentoRepository,
    private readonly osPecaRepository: IOsPecaRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(
    id: string,
    data: {
      valor_total_servicos: number;
      valor_total_pecas: number;
      pecas?: Array<{ id_peca: string; quantidade: number; preco_unitario: number }>;
    }
  ): Promise<Orcamento> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeLancarServicosInsumos();

    if (data.pecas && data.pecas.length > 0) {
      await this.osPecaRepository.replaceAll(
        id,
        data.pecas.map((p) => ({
          id_peca: p.id_peca,
          quantidade: p.quantidade,
          preco_unitario: p.preco_unitario,
          valor_total: p.quantidade * p.preco_unitario,
        }))
      );
    }

    await this.emissor.emitir(
      new ServicosEInsumosListados(id, data.valor_total_servicos, data.valor_total_pecas)
    );
    const orcamento = await this.orcamentoRepository.findByOrdemServicoId(id);
    if (!orcamento) {
      throw new EntityNotFoundException('Orcamento', id);
    }
    return orcamento;
  }
}

// UC-01A / PATCH administrativo antes da execução
export class AtualizarOrdemServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  async execute(
    id: string,
    data: {
      status?: 'RECEIVED' | 'UNDER_DIAGNOSIS' | 'AWAITING_APPROVAL';
      descricao?: string;
    }
  ): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeAtualizar();

    return this.ordemServicoRepository.update(id, {
      ...(data.status && { status: data.status }),
      ...(data.descricao !== undefined && { descricao: data.descricao }),
    });
  }
}

// UC-07
export class FinalizarExecucaoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeFinalizar();
    await this.emissor.emitir(new ServicoConcluidoPeloMecanico(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-08
export class AprovarServicoPrestadoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeAprovarServico();
    await this.emissor.emitir(new ServicoAprovadoPeloCliente(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-09
export class RegistrarEntregaVeiculoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeRegistrarEntrega();

    await this.emissor.emitir(new PagamentoRegistrado(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-10
export class ConsultarStatusOrdemServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<{ ordemServicoId: string; status: string }> {
    const os = await this.ordemServicoRepository.findOne(id);
    return { ordemServicoId: os.id, status: os.status };
  }
}

// UC-11
export class ListarOrdensServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  async execute(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: OrdemDeServico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.ordemServicoRepository.findAll(page, limit, search);
  }
}

// UC-12
export class DetalharOrdemServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    return this.ordemServicoRepository.findOne(id);
  }
}

// Admin: delete
export class DeletarOrdemServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    return this.ordemServicoRepository.remove(id);
  }
}
