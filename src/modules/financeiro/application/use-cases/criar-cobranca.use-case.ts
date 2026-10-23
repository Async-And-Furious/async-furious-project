import { Pagamento } from '../../domain/entities/pagamento.entity';
import type {
  IGatewayPagamento,
  IPagamentoRepository,
} from '../../domain/interfaces/pagamento.interface';
import { ConflitoException } from '../../../../shared/domain/exceptions/conflito.exception';

export interface CriarCobrancaCommand {
  ordemServicoId: string;
  valor: number;
}

export interface EsperaCobranca {
  tentativas: number;
  intervaloMs: number;
}

const ESPERA_PADRAO: EsperaCobranca = { tentativas: 10, intervaloMs: 500 };

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Uma cobrança por OS. O Mercado Pago não respeita X-Idempotency-Key em /checkout/preferences
// (testado em 20/10/2026), então a garantia vem do banco: o Pagamento é reservado
// (constraint única em ordemServicoId) antes de chamar o Mercado Pago.
export class CriarCobrancaUseCase {
  constructor(
    private readonly repository: IPagamentoRepository,
    private readonly gateway: IGatewayPagamento,
    private readonly espera: EsperaCobranca = ESPERA_PADRAO
  ) {}

  async execute(command: CriarCobrancaCommand): Promise<string> {
    return this.obterOuCriar(command, true);
  }

  private async obterOuCriar(command: CriarCobrancaCommand, podeLimpar: boolean): Promise<string> {
    const { ordemServicoId, valor } = command;

    const existente = await this.repository.findByOrdemServicoId(ordemServicoId);
    if (existente) {
      return this.reaproveitar(existente, command, podeLimpar);
    }

    const pagamento = Pagamento.criar(ordemServicoId, valor);
    if (!(await this.repository.reservar(pagamento))) {
      return this.aguardarOutraAprovacao(ordemServicoId);
    }

    try {
      const { preferenceId, linkPagamento } = await this.gateway.criarCobranca(
        ordemServicoId,
        valor
      );
      pagamento.vincularCobranca(preferenceId, linkPagamento);
      await this.repository.save(pagamento);
      return linkPagamento;
    } catch (error) {
      // Falha no Mercado Pago não deixa estado: a reserva é desfeita e o orçamento segue PENDING.
      await this.repository.remover(pagamento.getId());
      throw error;
    }
  }

  private async reaproveitar(
    existente: Pagamento,
    command: CriarCobrancaCommand,
    podeLimpar: boolean
  ): Promise<string> {
    const link = existente.getLinkPagamento();
    if (link) {
      return link;
    }
    if (!existente.estaPendente()) {
      throw new ConflitoException(`A OS já tem um pagamento com status ${existente.getStatus()}.`);
    }

    // Pendente sem link: outra aprovação está criando a cobrança, ou é um registro antigo sem link.
    const atual = await this.aguardarLink(command.ordemServicoId);
    const linkAtual = atual?.getLinkPagamento();
    if (linkAtual) {
      return linkAtual;
    }
    if (atual && podeLimpar) {
      await this.repository.remover(atual.getId());
    }
    if (podeLimpar) {
      return this.obterOuCriar(command, false);
    }
    throw new ConflitoException('A cobrança desta OS está sendo criada. Tente novamente.');
  }

  private async aguardarOutraAprovacao(ordemServicoId: string): Promise<string> {
    const atual = await this.aguardarLink(ordemServicoId);
    const link = atual?.getLinkPagamento();
    if (link) {
      return link;
    }
    throw new ConflitoException('A cobrança desta OS está sendo criada. Tente novamente.');
  }

  private async aguardarLink(ordemServicoId: string): Promise<Pagamento | null> {
    let atual: Pagamento | null = null;
    for (let tentativa = 0; tentativa < this.espera.tentativas; tentativa++) {
      await esperar(this.espera.intervaloMs);
      atual = await this.repository.findByOrdemServicoId(ordemServicoId);
      if (!atual || atual.getLinkPagamento() || !atual.estaPendente()) {
        return atual;
      }
    }
    return atual;
  }
}
