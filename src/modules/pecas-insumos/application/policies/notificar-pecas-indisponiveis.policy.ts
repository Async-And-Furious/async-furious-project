import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { PecasNaoExistem } from '../../domain/events/pecas-nao-existem.event';
import { PecasIndisponiveis } from '../../domain/events/pecas-indisponiveis.event';

@Injectable()
export class NotificarPecasIndisponiveisPolicy {
  constructor(private readonly emissor: EmissorEventos) {}

  @OnEvent('PecasNaoExistem')
  async handle(evento: PecasNaoExistem): Promise<void> {
    await this.emissor.emitir(
      new PecasIndisponiveis(evento.ordemServicoId, evento.idsPecasIndisponiveis)
    );
  }
}
