import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { ServicoAprovadoPeloCliente } from '../../domain/events/servico-aprovado-pelo-cliente.event';
import { StatusAtualizadoEntregue } from '../../domain/events/status-atualizado-entregue.event';

@Injectable()
export class AtualizarStatusEntreguePolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('ServicoAprovadoPeloCliente')
  async handle(evento: ServicoAprovadoPeloCliente): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'DELIVERED',
      entregue_em: new Date(),
    });
    await this.emissor.emitir(new StatusAtualizadoEntregue(evento.ordemServicoId));
  }
}
