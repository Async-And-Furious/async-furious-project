import { NotFoundException } from '@nestjs/common';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { BarramentoEventos } from '../../../../shared/infrastructure/barramento-eventos/barramento-eventos.service';
import type { Orcamento } from '../../domain/entities/orcamento.entity';
import type { IOrcamentoRepository } from '../../domain/interfaces/orcamento.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrcamentoAprovado } from '../../domain/events/orcamento-aprovado.event';
import { OrcamentoRecusado } from '../../domain/events/orcamento-recusado.event';

// UC-05
export class AprovarOrcamentoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly orcamentoRepository: IOrcamentoRepository,
    private readonly barramento: BarramentoEventos,
  ) {}

  async execute(id_ordem_servico: string): Promise<Orcamento> {
    await this.ordemServicoRepository.findOne(id_ordem_servico);

    const orcamento = await this.orcamentoRepository.findByOrdemServicoId(id_ordem_servico);
    if (!orcamento) {
      throw new NotFoundException('Nenhum orçamento encontrado para esta Ordem de Serviço.');
    }

    if (orcamento.status !== 'PENDING') {
      throw new DomainException(`Orçamento não está pendente. Status atual: ${orcamento.status}`);
    }

    if (orcamento.valor_total_geral <= 0) {
      throw new DomainException('Não é possível aprovar orçamento sem valores definidos.');
    }

    const approved = await this.orcamentoRepository.update(orcamento.id, { status: 'APPROVED' });
    await this.barramento.emitir(
      new OrcamentoAprovado(id_ordem_servico, approved.id, approved.valor_total_pecas),
    );
    return approved;
  }
}

// UC-06
export class RecusarOrcamentoUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly orcamentoRepository: IOrcamentoRepository,
    private readonly barramento: BarramentoEventos,
  ) {}

  async execute(id_ordem_servico: string): Promise<Orcamento> {
    await this.ordemServicoRepository.findOne(id_ordem_servico);

    const orcamento = await this.orcamentoRepository.findByOrdemServicoId(id_ordem_servico);
    if (!orcamento) {
      throw new NotFoundException('Nenhum orçamento encontrado para esta Ordem de Serviço.');
    }

    if (orcamento.status !== 'PENDING') {
      throw new DomainException(`Orçamento não está pendente. Status atual: ${orcamento.status}`);
    }

    const rejected = await this.orcamentoRepository.update(orcamento.id, { status: 'REJECTED' });
    await this.barramento.emitir(new OrcamentoRecusado(id_ordem_servico, rejected.id));
    return rejected;
  }
}
