import { Pagamento } from '../../domain/entities/pagamento.entity';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
} from '../../domain/interfaces/pagamento.interface';

export interface CriarCobrancaCommand {
  ordemServicoId: string;
  valor: number;
}

export class CriarCobrancaUseCase {
  constructor(
    private readonly repository: IPagamentoRepository,
    private readonly gateway: IGatewayPagamento
  ) {}

  // Idempotente por OS: uma cobrança já criada devolve o mesmo link, sem nova preference.
  async execute(command: CriarCobrancaCommand): Promise<string> {
    const { ordemServicoId, valor } = command;

    const existente = await this.repository.findCobrancaByOrdemServicoId(ordemServicoId);
    const linkExistente = existente?.getLinkPagamento();
    if (linkExistente) {
      return linkExistente;
    }

    const pagamento = Pagamento.criar(ordemServicoId, valor);
    const { preferenceId, linkPagamento } = await this.gateway.criarCobranca(ordemServicoId, valor);
    pagamento.vincularCobranca(preferenceId, linkPagamento);

    await this.repository.save(pagamento);
    return linkPagamento;
  }
}
