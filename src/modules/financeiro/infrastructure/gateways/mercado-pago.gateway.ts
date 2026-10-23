import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, MPNotFoundError, Payment, Preference } from 'mercadopago';
import type {
  CobrancaCriada,
  IGatewayPagamento,
  PagamentoExterno,
} from '../../domain/interfaces/pagamento.interface';

// Timeout curto + 1 retry com backoff exponencial (feito pelo SDK em 429/5xx e falha de rede),
// para caber no prazo de resposta do webhook (22 s) e não segurar a aprovação.
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;

const descreverErro = (error: unknown): string =>
  error instanceof Error ? error.message : JSON.stringify(error);

// Checkout Pro: cria a preference e devolve o init_point (não existe mais link de sandbox).
@Injectable()
export class MercadoPagoGateway implements IGatewayPagamento {
  private readonly logger = new Logger(MercadoPagoGateway.name);

  constructor(private readonly config: ConfigService) {}

  async criarCobranca(ordemServicoId: string, valor: number): Promise<CobrancaCriada> {
    const client = this.criarClient();
    const notificationUrl = this.config.get<string>('MP_NOTIFICATION_URL') || undefined;

    let preferenceId: string | undefined;
    let linkPagamento: string | undefined;
    try {
      const result = await new Preference(client).create({
        body: {
          items: [
            {
              id: ordemServicoId,
              title: `Ordem de serviço ${ordemServicoId}`,
              quantity: 1,
              unit_price: valor,
              currency_id: 'BRL',
            },
          ],
          external_reference: ordemServicoId,
          notification_url: notificationUrl,
        },
      });
      preferenceId = result.id;
      linkPagamento = result.init_point;
    } catch (error) {
      this.logger.error(
        `Falha ao criar preference no Mercado Pago para a OS ${ordemServicoId}: ${descreverErro(error)}`
      );
      throw new BadGatewayException('Não foi possível gerar o link de pagamento no Mercado Pago.');
    }

    if (!preferenceId || !linkPagamento) {
      this.logger.error(`Preference sem id/init_point para a OS ${ordemServicoId}`);
      throw new BadGatewayException('Não foi possível gerar o link de pagamento no Mercado Pago.');
    }

    return { preferenceId, linkPagamento };
  }

  async consultarPagamento(id: string): Promise<PagamentoExterno | null> {
    const client = this.criarClient();

    try {
      const pagamento = await new Payment(client).get({ id });
      return {
        id: String(pagamento.id ?? id),
        status: pagamento.status ?? '',
        referenciaExterna: pagamento.external_reference ?? null,
        valor:
          typeof pagamento.transaction_amount === 'number' ? pagamento.transaction_amount : null,
      };
    } catch (error) {
      if (error instanceof MPNotFoundError) {
        return null;
      }
      this.logger.error(
        `Falha ao consultar o pagamento ${id} no Mercado Pago: ${descreverErro(error)}`
      );
      throw new BadGatewayException('Não foi possível consultar o pagamento no Mercado Pago.');
    }
  }

  private criarClient(): MercadoPagoConfig {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MP_ACCESS_TOKEN não configurado.');
    }
    return new MercadoPagoConfig({
      accessToken,
      options: { timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES },
    });
  }
}
