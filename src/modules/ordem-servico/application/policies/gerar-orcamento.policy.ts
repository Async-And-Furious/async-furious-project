import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrcamentoRepository } from '../../domain/interfaces/orcamento.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrcamentoVo } from '../../domain/value-objects/orcamento.vo';
import { ServicosEInsumosListados } from '../../domain/events/servicos-e-insumos-listados.event';
import { OrcamentoGerado } from '../../domain/events/orcamento-gerado.event';
import type { Orcamento } from '../../domain/entities/orcamento.entity';

@Injectable()
export class GerarOrcamentoPolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly orcamentoRepository: IOrcamentoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('ServicosEInsumosListados')
  async handle(evento: ServicosEInsumosListados): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);

    if (!['UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'].includes(os.status)) {
      throw new DomainException(
        `Orçamento só pode ser gerado quando OS está Em Diagnóstico ou Aguardando Aprovação. Status atual: ${os.status}`
      );
    }

    const vo = OrcamentoVo.create({
      valor_total_servicos: evento.valorTotalServicos,
      valor_total_pecas: evento.valorTotalPecas,
    });

    const existing = await this.orcamentoRepository.findByOrdemServicoId(evento.ordemServicoId);

    if (existing?.status === 'APPROVED') {
      throw new DomainException('Não é possível alterar orçamento já aprovado.');
    }

    let orcamento: Orcamento;
    if (existing) {
      orcamento = await this.orcamentoRepository.update(existing.id, {
        valor_total_servicos: vo.getValorTotalServicos().toNumber(),
        valor_total_pecas: vo.getValorTotalPecas().toNumber(),
        valor_total_geral: vo.getValorTotalGeral().toNumber(),
        status: 'PENDING',
      });
    } else {
      orcamento = await this.orcamentoRepository.create({
        id_ordem_servico: evento.ordemServicoId,
        valor_total_servicos: vo.getValorTotalServicos().toNumber(),
        valor_total_pecas: vo.getValorTotalPecas().toNumber(),
        valor_total_geral: vo.getValorTotalGeral().toNumber(),
      });
    }

    await this.emissor.emitir(new OrcamentoGerado(evento.ordemServicoId, orcamento.id));
  }
}
