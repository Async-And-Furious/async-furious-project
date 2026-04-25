import { BadRequestException } from '@nestjs/common';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import { OrcamentoVo } from '../../domain/value-objects/orcamento.vo';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';

export class GerarOrcamentoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(
    id: string,
    data: { valor_total_servicos: number; valor_total_pecas: number }
  ): Promise<OrdemDeServico> {
    const ordemDeServico = await this.repository.findOne(id);
    if (!ordemDeServico) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id} não encontrada`);
    }

    if (ordemDeServico.orcamento_status === 'APPROVED') {
      throw new BadRequestException(
        'Não é possível gerar novo orçamento. Existe um orçamento já aprovado.'
      );
    }

    const orcamento = OrcamentoVo.create(data);

    return this.repository.update(id, {
      valor_total_servicos: orcamento.getValorTotalServicos(),
      valor_total_pecas: orcamento.getValorTotalPecas(),
      valor_total_geral: orcamento.getValorTotalGeral(),
      orcamento_status: 'PENDING',
    });
  }
}

export class AprovarOrcamentoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const ordemDeServico = await this.repository.findOne(id);
    if (!ordemDeServico) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id} não encontrada`);
    }

    if (ordemDeServico.orcamento_status !== 'PENDING') {
      throw new BadRequestException(
        `Orçamento não está pendente. Status atual: ${ordemDeServico.orcamento_status}`
      );
    }

    if (ordemDeServico.valor_total_geral <= 0) {
      throw new BadRequestException('Não é possível aprovar orçamento sem valores definidos.');
    }

    return this.repository.update(id, {
      orcamento_status: 'APPROVED',
      status: 'IN_PROGRESS',
    });
  }
}

export class RejeitarOrcamentoUseCase {
  constructor(private readonly repository: IOrdemServicoRepository) {}

  async execute(id: string): Promise<OrdemDeServico> {
    const ordemDeServico = await this.repository.findOne(id);
    if (!ordemDeServico) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id} não encontrada`);
    }

    if (ordemDeServico.orcamento_status !== 'PENDING') {
      throw new BadRequestException(
        `Orçamento não está pendente. Status atual: ${ordemDeServico.orcamento_status}`
      );
    }

    return this.repository.update(id, { orcamento_status: 'REJECTED' });
  }
}
