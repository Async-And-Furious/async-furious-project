import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import type { IPagamentoRepository } from '../../domain/interfaces/pagamento.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { ConflitoException } from '../../../../shared/domain/exceptions/conflito.exception';

export interface RegistrarPagamentoCommand {
  ordemServicoId: string;
}

// Não cria nem marca pagamento: o status vem do Mercado Pago (webhook). Aqui só se dispara
// a entrega da OS, e apenas quando o pagamento já foi confirmado.
export class RegistrarPagamentoUseCase {
  constructor(
    private readonly repository: IPagamentoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(command: RegistrarPagamentoCommand): Promise<void> {
    const { ordemServicoId } = command;

    const pagamento = await this.repository.findByOrdemServicoId(ordemServicoId);
    if (!pagamento || pagamento.getStatus() !== 'CONFIRMADO') {
      throw new ConflitoException(
        `A OS ${ordemServicoId} não tem pagamento confirmado pelo Mercado Pago.`
      );
    }

    await this.emissor.emitir(new PagamentoRegistradoEvent(pagamento.getId(), ordemServicoId));
  }
}
