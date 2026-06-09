import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { PecasNaoExistem } from '../../domain/events/pecas-nao-existem.event';
import { PecasIndisponiveis } from '../../domain/events/pecas-indisponiveis.event';

@Injectable()
export class NotificarPecasIndisponiveisPolicy {
  constructor(private readonly emissor: IEmissorEventos) {}

  @OnEvent('PecasNaoExistem')
  async handle(evento: PecasNaoExistem): Promise<void> {
    await this.emissor.emitir(
      new PecasIndisponiveis(evento.ordemServicoId, evento.idsPecasIndisponiveis)
    );
  }
}
