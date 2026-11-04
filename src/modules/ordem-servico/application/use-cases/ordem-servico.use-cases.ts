import { ConflitoException } from '../../../../shared/domain/exceptions/conflito.exception';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { IOsPecaRepository } from '../../domain/interfaces/os-peca.interface';
import { OrdemServicoCriada } from '../../domain/events/ordem-servico-criada.event';
import { OrdemServicoRecebida } from '../../domain/events/ordem-servico-recebida.event';
import { OrcamentoCalculado } from '../../domain/events/orcamento-calculado.event';
import { ServicoAprovadoPeloCliente } from '../../domain/events/servico-aprovado-pelo-cliente.event';
import { OrcamentoVo } from '../../domain/value-objects/orcamento.vo';
import type { UpdateServiceOrderStatusUseCase } from './update-service-order-status.use-case';
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
    private readonly emissor: IEmissorEventos
  ) {}

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
    cliente ??= await this.clienteRepository.create(data.cliente);

    // 2. Criar ou Obter Veículo
    let veiculo = await this.veiculoRepository.findByPlaca(data.veiculo.placa);
    veiculo ??= await this.veiculoRepository.create({
      ...data.veiculo,
      clienteId: cliente.id,
    });
    if (veiculo.clienteId !== cliente.id) {
      throw new ConflitoException('O veículo com esta placa pertence a outro cliente');
    }

    // 3. Obter Preços e Calcular Totais
    const servicosComPreco: Array<{
      id_servico: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
    }> = [];
    for (const item of data.servicos) {
      const servico = await this.servicoRepository.findOne(item.id_servico);
      const preco = Number(servico.preco);
      const total = preco * item.quantidade;
      servicosComPreco.push({
        id_servico: item.id_servico,
        quantidade: item.quantidade,
        preco_unitario: preco,
        valor_total: total,
      });
    }

    const pecasComPreco: Array<{
      id_peca: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
    }> = [];
    for (const item of data.pecas) {
      const peca = await this.pecaInsumoRepository.findOne(item.id_peca);
      const preco = Number(peca.preco);
      const total = preco * item.quantidade;
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

    // O Orcamento é do Billing: nasce de OrcamentoCalculado, publicado em servicos-insumos.
    await this.emissor.emitir(new OrdemServicoCriada(os.id, os.clienteId, os.veiculoId));
    await this.emissor.emitir(new OrdemServicoRecebida(os.id));
    return this.ordemServicoRepository.findOne(os.id);
  }
}

export interface TotaisOrcamentoCalculado {
  ordemServicoId: string;
  valorTotalServicos: number;
  valorTotalPecas: number;
  valorTotalGeral: number;
}

// UC-04
export class ListarServicosInsumosNaOsUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
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
  ): Promise<TotaisOrcamentoCalculado> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeLancarServicosInsumos();

    // Calcula (e valida) os totais antes de gravar OsPeca: valor inválido não deixa efeito colateral.
    const totais = OrcamentoVo.create({
      valor_total_servicos: data.valor_total_servicos,
      valor_total_pecas: data.valor_total_pecas,
    });
    const resultado: TotaisOrcamentoCalculado = {
      ordemServicoId: id,
      valorTotalServicos: totais.getValorTotalServicos().toNumber(),
      valorTotalPecas: totais.getValorTotalPecas().toNumber(),
      valorTotalGeral: totais.getValorTotalGeral().toNumber(),
    };

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
      new OrcamentoCalculado(
        id,
        resultado.valorTotalServicos,
        resultado.valorTotalPecas,
        resultado.valorTotalGeral
      )
    );
    return resultado;
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

// UC-09: único caminho de escrita para DELIVERED (o webhook rejeita esse status).
// Sem checagem de pagamento: FINISHED só existe depois de PagamentoConfirmado (saga-flow.md §4).
export class RegistrarEntregaVeiculoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly atualizarStatus: UpdateServiceOrderStatusUseCase
  ) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const os = await this.ordemServicoRepository.findOne(id);
    os.podeRegistrarEntrega();
    return this.atualizarStatus.execute(id, 'DELIVERED');
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
