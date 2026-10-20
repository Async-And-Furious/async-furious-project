import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import type {
  CobrancaCriada,
  IGatewayPagamento,
} from '../../domain/interfaces/pagamento.interface';

const TIMEOUT_MS = 5000;

// Checkout Pro: cria a preference e devolve o init_point (não existe mais link de sandbox).
@Injectable()
export class MercadoPagoGateway implements IGatewayPagamento {
  private readonly logger = new Logger(MercadoPagoGateway.name);

  constructor(private readonly config: ConfigService) {}

  async criarCobranca(ordemServicoId: string, valor: number): Promise<CobrancaCriada> {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MP_ACCESS_TOKEN não configurado.');
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: TIMEOUT_MS } });
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
        `Falha ao criar preference no Mercado Pago para a OS ${ordemServicoId}: ${
          error instanceof Error ? error.message : JSON.stringify(error)
        }`
      );
      throw new BadGatewayException('Não foi possível gerar o link de pagamento no Mercado Pago.');
    }

    if (!preferenceId || !linkPagamento) {
      this.logger.error(`Preference sem id/init_point para a OS ${ordemServicoId}`);
      throw new BadGatewayException('Não foi possível gerar o link de pagamento no Mercado Pago.');
    }

    return { preferenceId, linkPagamento };
  }
}
