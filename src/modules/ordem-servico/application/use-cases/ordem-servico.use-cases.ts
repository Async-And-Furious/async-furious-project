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
import type { IClienteRepository } from '../../../cadastro/domain/interfaces/cliente.interface';
import type { IVeiculoRepository } from '../../../cadastro/domain/interfaces/veiculo.interface';
import type { IServicoRepository } from '../../../cadastro/domain/interfaces/servico.interface';
import type { IPecaInsumoRepository } from '../../../pecas-insumos/domain/interfaces/peca-insumo.interface';
import type { IOsServicoRepository } from '../../domain/interfaces/os-servico.interface';

// UC-01
export class CriarOrdemServicoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly clienteRepository: IClienteRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly servicoRepository: IServicoRepository,
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly osServicoRepository: IOsServicoRepository,
    private readonly osPecaRepository: IOsPecaRepository,
    private readonly orcamentoRepository: IOrcamentoRepository,
    private readonly emissor: IEmissorEventos
  ) { }

  async execute(data: {
    cliente: {
      nome: string;
      email: string;
      telefone?: string;
      documento: string;
      tipoDocumento: 'CPF' | 'CNPJ';
    };
    veiculo: {
      placa: string;
      marca: string;
      modelo: string;
      ano: number;
      cor?: string;
    };
    servicos: Array<{ id_servico: string; quantidade: number }>;
    pecas: Array<{ id_peca: string; quantidade: number }>;
    descricao?: string;
  }): Promise<OrdemDeServico> {
    // 1. Criar ou Obter Cliente
    let cliente = await this.clienteRepository.findByDocumento(data.cliente.documento);
    if (!cliente) {
      cliente = await this.clienteRepository.create(data.cliente);
    }

    // 2. Criar ou Obter Veículo
    let veiculo = await this.veiculoRepository.findByPlaca(data.veiculo.placa);
    if (!veiculo) {
      veiculo = await this.veiculoRepository.create({
        ...data.veiculo,
        clienteId: cliente.id,
      });
    }

    // 3. Obter Preços e Calcular Totais
    let valorTotalServicos = 0;
    const servicosComPreco: Array<{ id_servico: string; quantidade: number; preco_unitario: number; valor_total: number }> = [];
    for (const item of data.servicos) {
      const servico = await this.servicoRepository.findOne(item.id_servico);
      const preco = Number(servico.preco);
      const total = preco * item.quantidade;
      valorTotalServicos += total;
      servicosComPreco.push({
        id_servico: item.id_servico,
        quantidade: item.quantidade,
        preco_unitario: preco,
        valor_total: total,
      });
    }

    let valorTotalPecas = 0;
    const pecasComPreco: Array<{ id_peca: string; quantidade: number; preco_unitario: number; valor_total: number }> = [];
    for (const item of data.pecas) {
      const peca = await this.pecaInsumoRepository.findOne(item.id_peca);
      const preco = Number(peca.preco);
      const total = preco * item.quantidade;
      valorTotalPecas += total;
      pecasComPreco.push({
        id_peca: item.id_peca,
        quantidade: item.quantidade,
        preco_unitario: preco,
        valor_total: total,
      });
    }

    // 4. Criar Ordem de Serviço
    const os = await this.ordemServicoRepository.create({
      veiculoId: veiculo.id,
      clienteId: cliente.id,
      descricao: data.descricao,
    });

    // 5. Vincular Serviços e Peças
    if (servicosComPreco.length > 0) {
      await this.osServicoRepository.replaceAll(os.id, servicosComPreco);
    }
    if (pecasComPreco.length > 0) {
      await this.osPecaRepository.replaceAll(os.id, pecasComPreco);
    }

    // 6. Gerar Orçamento Automático
    // Assumindo que a interface IOrcamentoRepository possui um método create ou que podemos injetar CriarOrcamentoUseCase. 
    // Como a OS acabou de ser criada, o orcamento ainda não existe, então usamos o repository.create.
    await this.orcamentoRepository.create({
      id_ordem_servico: os.id,
      valor_total_servicos: valorTotalServicos,
      valor_total_pecas: valorTotalPecas,
      valor_total_geral: valorTotalServicos + valorTotalPecas,
    });

    await this.emissor.emitir(new OrdemServicoCriada(os.id, os.clienteId, os.veiculoId));
    return this.ordemServicoRepository.findOne(os.id);
  }
}

// UC-02
export class AssumirOrdemServicoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) { }

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
  ) { }

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
  ) { }

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
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) { }

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
  ) { }

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
  ) { }

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
  ) { }

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeRegistrarEntrega();

    await this.emissor.emitir(new PagamentoRegistrado(id));
    return this.ordemServicoRepository.findOne(id);
  }
}

// UC-10
export class ConsultarStatusOrdemServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) { }

  async execute(id: string): Promise<{ ordemServicoId: string; status: string }> {
    const os = await this.ordemServicoRepository.findOne(id);
    return { ordemServicoId: os.id, status: os.status };
  }
}

// UC-11
export class ListarOrdensServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) { }

  async execute(
    page?: number,
    limit?: number
  ): Promise<{
    data: OrdemDeServico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.ordemServicoRepository.findAllAtivas(page, limit);
  }
}

// UC-12
export class DetalharOrdemServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) { }

  async execute(id: string): Promise<OrdemDeServico> {
    return this.ordemServicoRepository.findOne(id);
  }
}

// Admin: delete
export class DeletarOrdemServicoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) { }

  async execute(id: string): Promise<OrdemDeServico> {
    return this.ordemServicoRepository.remove(id);
  }
}
