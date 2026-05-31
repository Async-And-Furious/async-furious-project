import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pagamento } from '../../domain/entities/pagamento.entity';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import type {
  IPagamentoEventPublisher,
  IPagamentoRepository,
} from '../../domain/interfaces/pagamento.interface';
import {
  PAGAMENTO_EVENT_PUBLISHER,
  PAGAMENTO_REPOSITORY,
} from '../../domain/interfaces/pagamento.interface';

// O "Command" agora é apenas uma interface ou DTO tipado para a função
export interface RecepcionistaRegistraPagamentoCommand {
  ordemServicoId: string;
  valor: number;
}

@Injectable()
export class RegistrarPagamentoPolicy {
  private readonly logger = new Logger(RegistrarPagamentoPolicy.name);

  constructor(
    @Inject(PAGAMENTO_REPOSITORY)
    private readonly repository: IPagamentoRepository,
    @Inject(PAGAMENTO_EVENT_PUBLISHER)
    private readonly emissor: IPagamentoEventPublisher
  ) {}

  async execute(command: RecepcionistaRegistraPagamentoCommand): Promise<void> {
    const { ordemServicoId, valor } = command;

    // 1. Cria a Entidade (Domínio)
    const pagamento = Pagamento.criar(ordemServicoId, valor);

    // 2. Executa a regra
    pagamento.registrar();

    // 3. Persiste no banco de dados
    await this.repository.save(pagamento);

    // 4. Emite o evento manualmente (Isso acionará a P-27)
    const evento = new PagamentoRegistradoEvent(pagamento.getId(), ordemServicoId);
    await this.emissor.emitir(evento);

    this.logger.log(`[P-26] Pagamento persistido e evento emitido para OS: ${ordemServicoId}`);
  }
}
