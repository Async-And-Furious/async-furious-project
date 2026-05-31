import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { PagamentoRegistrado } from '../../domain/events/pagamento-registrado.event';
import { StatusAtualizadoEntregue } from '../../domain/events/status-atualizado-entregue.event';

@Injectable()
export class AtualizarStatusEntreguePolicy {
  private readonly logger = new Logger(AtualizarStatusEntreguePolicy.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('PagamentoRegistrado')
  async handle(evento: PagamentoRegistrado): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status !== 'FINISHED') {
      this.logger.warn(
        `[P-13] OS ${evento.ordemServicoId} em status inválido para entrega: ${os.status}`
      );
      return;
    }
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'DELIVERED',
      entregue_em: new Date(),
    });
    await this.emissor.emitir(new StatusAtualizadoEntregue(evento.ordemServicoId));
  }
}
