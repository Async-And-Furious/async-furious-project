import { Pagamento } from '../../domain/entities/pagamento.entity';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import type { IPagamentoRepository } from '../../domain/interfaces/pagamento.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';

export interface RegistrarPagamentoCommand {
  ordemServicoId: string;
  valor: number;
}

export class RegistrarPagamentoUseCase {
  constructor(
    private readonly repository: IPagamentoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(command: RegistrarPagamentoCommand): Promise<void> {
    const { ordemServicoId, valor } = command;

    const pagamento = Pagamento.criar(ordemServicoId, valor);
    pagamento.registrar();

    await this.repository.save(pagamento);

    const evento = new PagamentoRegistradoEvent(pagamento.getId(), ordemServicoId);
    await this.emissor.emitir(evento);
  }
}