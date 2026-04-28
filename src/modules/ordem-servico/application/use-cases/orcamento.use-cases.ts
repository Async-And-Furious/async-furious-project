import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Orcamento } from '../../domain/entities/orcamento.entity';
import { OrcamentoVo } from '../../domain/value-objects/orcamento.vo';
import type { IOrcamentoRepository } from '../../domain/interfaces/orcamento.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';

export class GerarOrcamentoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly orcamentoRepository: IOrcamentoRepository
  ) {}

  async execute(
    id_ordem_servico: string,
    data: { valor_total_servicos: number; valor_total_pecas: number }
  ): Promise<Orcamento> {
    const os = await this.ordemServicoRepository.findOne(id_ordem_servico);
    if (!os) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id_ordem_servico} não encontrada`);
    }

    const orcamentoExistente =
      await this.orcamentoRepository.findByOrdemServicoId(id_ordem_servico);
    if (orcamentoExistente?.status === 'APPROVED') {
      throw new BadRequestException(
        'Não é possível gerar novo orçamento. Existe um orçamento já aprovado.'
      );
    }

    const vo = OrcamentoVo.create(data);

    if (orcamentoExistente) {
      return this.orcamentoRepository.update(orcamentoExistente.id, {
        valor_total_servicos: vo.getValorTotalServicos().toNumber(),
        valor_total_pecas: vo.getValorTotalPecas().toNumber(),
        valor_total_geral: vo.getValorTotalGeral().toNumber(),
        status: 'PENDING',
      });
    }

    return this.orcamentoRepository.create({
      id_ordem_servico,
      valor_total_servicos: vo.getValorTotalServicos().toNumber(),
      valor_total_pecas: vo.getValorTotalPecas().toNumber(),
      valor_total_geral: vo.getValorTotalGeral().toNumber(),
    });
  }
}

export class AprovarOrcamentoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly orcamentoRepository: IOrcamentoRepository
  ) {}

  async execute(id_ordem_servico: string): Promise<Orcamento> {
    const os = await this.ordemServicoRepository.findOne(id_ordem_servico);
    if (!os) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id_ordem_servico} não encontrada`);
    }

    const orcamento = await this.orcamentoRepository.findByOrdemServicoId(id_ordem_servico);
    if (!orcamento) {
      throw new NotFoundException('Nenhum orçamento encontrado para esta Ordem de Serviço.');
    }

    if (orcamento.status !== 'PENDING') {
      throw new BadRequestException(
        `Orçamento não está pendente. Status atual: ${orcamento.status}`
      );
    }

    if (orcamento.valor_total_geral <= 0) {
      throw new BadRequestException('Não é possível aprovar orçamento sem valores definidos.');
    }

    await this.ordemServicoRepository.update(id_ordem_servico, { status: 'IN_PROGRESS' });

    return this.orcamentoRepository.update(orcamento.id, { status: 'APPROVED' });
  }
}

export class RejeitarOrcamentoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly orcamentoRepository: IOrcamentoRepository
  ) {}

  async execute(id_ordem_servico: string): Promise<Orcamento> {
    const os = await this.ordemServicoRepository.findOne(id_ordem_servico);
    if (!os) {
      throw new BadRequestException(`Ordem de Serviço com ID ${id_ordem_servico} não encontrada`);
    }

    const orcamento = await this.orcamentoRepository.findByOrdemServicoId(id_ordem_servico);
    if (!orcamento) {
      throw new NotFoundException('Nenhum orçamento encontrado para esta Ordem de Serviço.');
    }

    if (orcamento.status !== 'PENDING') {
      throw new BadRequestException(
        `Orçamento não está pendente. Status atual: ${orcamento.status}`
      );
    }

    return this.orcamentoRepository.update(orcamento.id, { status: 'REJECTED' });
  }
}
