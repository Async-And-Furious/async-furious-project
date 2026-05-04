import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrcamentoAprovadoComPecas } from '../../../ordem-servico/domain/events/orcamento-aprovado-com-pecas.event';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { PecasEmEstoqueConfirmadas } from '../../domain/events/pecas-em-estoque-confirmadas.event';
import { PecasNaoExistem } from '../../domain/events/pecas-nao-existem.event';

@Injectable()
export class VerificarDisponibilidadeEstoquePolicy {
  constructor(
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('OrcamentoAprovadoComPecas')
  async handle(evento: OrcamentoAprovadoComPecas): Promise<void> {
    const pecas = await this.pecaInsumoRepository.findByOrdemServicoId(evento.ordemServicoId);

    const indisponiveis = pecas
      .filter((item) => item.quantidade_estoque < item.quantidade)
      .map((item) => item.id_peca);

    if (indisponiveis.length > 0) {
      await this.emissor.emitir(new PecasNaoExistem(evento.ordemServicoId, indisponiveis));
      return;
    }

    await this.emissor.emitir(
      new PecasEmEstoqueConfirmadas(
        evento.ordemServicoId,
        pecas.map((item) => ({
          id_peca: item.id_peca,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
        }))
      )
    );
  }
}
