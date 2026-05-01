import { NotFoundException } from '@nestjs/common';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
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
    private readonly emissor: EmissorEventos
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
    private readonly emissor: EmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    if (os.status !== 'RECEIVED') {
      throw new DomainException(
        `OS deve estar no status Recebida para ser assumida. Status atual: ${os.status}`
      );
    }
    await this.emissor.emitir(new OrdemServicoAssumida(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-03
export class AnalisarVeiculoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    if (os.status !== 'UNDER_DIAGNOSIS') {
      throw new DomainException(
        `OS deve estar Em Diagnóstico para analisar o veículo. Status atual: ${os.status}`
      );
    }
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
    private readonly emissor: EmissorEventos
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
    if (!['UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'].includes(os.status)) {
      throw new DomainException(
        `OS deve estar Em Diagnóstico ou Aguardando Aprovação. Status atual: ${os.status}`
      );
    }

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
      throw new NotFoundException('Orçamento não foi gerado após listar serviços e insumos.');
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

    if (!['RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'].includes(os.status)) {
      throw new DomainException(
        `A ordem de serviço só pode ser atualizada até Aguardando Aprovação. Status atual: ${os.status}`
      );
    }

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
    private readonly emissor: EmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    if (os.status !== 'IN_PROGRESS') {
      throw new DomainException(
        `OS deve estar Em Execução para ser finalizada. Status atual: ${os.status}`
      );
    }
    await this.emissor.emitir(new ServicoConcluidoPeloMecanico(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-08
export class AprovarServicoPrestadoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    if (os.status !== 'FINISHED') {
      throw new DomainException(
        `OS deve estar Finalizada para aprovação do serviço pelo cliente. Status atual: ${os.status}`
      );
    }
    await this.emissor.emitir(new ServicoAprovadoPeloCliente(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-09
export class RegistrarEntregaVeiculoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    if (os.status !== 'FINISHED') {
      throw new DomainException(
        `OS deve estar Finalizada para registrar a entrega. Status atual: ${os.status}`
      );
    }

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
