import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { PagamentoRegistrado } from '../../domain/events/pagamento-registrado.event';
import { StatusAtualizadoEntregue } from '../../domain/events/status-atualizado-entregue.event';

@Injectable()
export class AtualizarStatusEntreguePolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('PagamentoRegistrado')
  async handle(evento: PagamentoRegistrado): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'DELIVERED',
      entregue_em: new Date(),
    });
    await this.emissor.emitir(new StatusAtualizadoEntregue(evento.ordemServicoId));
  }
}
