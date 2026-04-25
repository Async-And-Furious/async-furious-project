import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import { OrcamentoVo } from '../../domain/value-objects/orcamento.vo';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';

export class GerarOrcamentoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(
    id: string,
    data: {
      valor_total_servicos: Decimal | number;
      valor_total_pecas: Decimal | number;
    }
  ): Promise<OrdemDeServico> {
    // Busca a OS para validar se existe
    const ordemDeServico = await this.repository.findOne(id);
    if (!ordemDeServico) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id} não encontrada`);
    }

    // Verifica se já existe orçamento aprovado
    if (ordemDeServico.orcamento_aprovado && ordemDeServico.orcamento_status === 'APPROVED') {
      throw new BadRequestException(
        'Não é possível gerar novo orçamento. Existe um orçamento já aprovado.'
      );
    }

    // Cria o orçamento usando o VO
    const orcamento = OrcamentoVo.create(data);

    // Atualiza a OS com os dados do orçamento
    return this.repository.update(id, {
      valor_total_servicos: orcamento.getValorTotalServicos(),
      valor_total_pecas: orcamento.getValorTotalPecas(),
      valor_total_geral: orcamento.getValorTotalGeral(),
      orcamento_status: 'PENDING',
      orcamento_aprovado: false,
    });
  }
}

export class AprovarOrcamentoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    // Busca a OS para validar se existe
    const ordemDeServico = await this.repository.findOne(id);
    if (!ordemDeServico) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id} não encontrada`);
    }

    // Verifica se existe orçamento pendente
    if (ordemDeServico.orcamento_status !== 'PENDING') {
      throw new BadRequestException(
        `Orçamento não está pendente. Status atual: ${ordemDeServico.orcamento_status}`
      );
    }

    // Verifica se já foi aprovado
    if (ordemDeServico.orcamento_aprovado) {
      throw new BadRequestException('Este orçamento já foi aprovado.');
    }

    // Aprova o orçamento
    const resultado = await this.repository.update(id, {
      orcamento_status: 'APPROVED',
      orcamento_aprovado: true,
      status: 'IN_PROGRESS',
    });

    return resultado;
  }
}

export class RejeitarOrcamentoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    // Busca a OS para validar se existe
    const ordemDeServico = await this.repository.findOne(id);
    if (!ordemDeServico) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id} não encontrada`);
    }

    // Verifica se existe orçamento pendente
    if (ordemDeServico.orcamento_status !== 'PENDING') {
      throw new BadRequestException(
        `Orçamento não está pendente. Status atual: ${ordemDeServico.orcamento_status}`
      );
    }

    // Rejeita o orçamento
    const resultado = await this.repository.update(id, {
      orcamento_status: 'REJECTED',
      orcamento_aprovado: false,
    });

    return resultado;
  }
}
