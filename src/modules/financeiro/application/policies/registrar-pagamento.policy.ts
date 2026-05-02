import { Injectable, Logger } from '@nestjs/common';
import { Pagamento } from '../../domain/entities/pagamento.entity';
import { PagamentoRepository } from '../../infrastructure/repositories/pagamento.repository';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';

// O "Command" agora é apenas uma interface ou DTO tipado para a função
export interface RecepcionistaRegistraPagamentoCommand {
  ordemServicoId: string;
  valor: number;
}

@Injectable()
export class RegistrarPagamentoPolicy {
  private readonly logger = new Logger(RegistrarPagamentoPolicy.name);

  constructor(
    private readonly repository: PagamentoRepository,
    private readonly emissor: EmissorEventos // <-- Ferramenta padrão do time
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
