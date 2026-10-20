import { Controller, HttpCode, HttpStatus, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../auth/decorators/public.decorator';
import { ProcessarNotificacaoPagamentoUseCase } from '../../application/use-cases/processar-notificacao-pagamento.use-case';
import { MercadoPagoAssinaturaGuard } from '../../infrastructure/webhooks/mercado-pago-assinatura.guard';

@ApiTags('Webhooks')
@Controller('webhooks/mercado-pago')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private readonly processarNotificacaoPagamentoUseCase: ProcessarNotificacaoPagamentoUseCase
  ) {}

  @Public()
  @UseGuards(MercadoPagoAssinaturaGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receber notificação do Mercado Pago (Checkout Pro)',
    description:
      'Público, autenticado pela assinatura x-signature. O status do pagamento vem da reconsulta ao Mercado Pago, nunca do corpo da notificação.',
  })
  @ApiQuery({ name: 'data.id', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiResponse({ status: 200, description: 'Notificação recebida.' })
  @ApiResponse({ status: 401, description: 'Assinatura ausente ou inválida.' })
  @ApiResponse({
    status: 502,
    description: 'Falha ao reconsultar o Mercado Pago (o Mercado Pago reenvia a notificação).',
  })
  async receber(@Query('data.id') dataId?: string, @Query('type') tipo?: string): Promise<void> {
    if (tipo !== 'payment' || !dataId) {
      this.logger.log(`Notificação do Mercado Pago ignorada: type=${tipo ?? '-'}`);
      return;
    }

    // Síncrono de propósito: falha na reconsulta devolve 5xx e o Mercado Pago reenvia.
    const resultado = await this.processarNotificacaoPagamentoUseCase.execute(dataId);
    const mensagem = `Notificação do pagamento ${dataId} no Mercado Pago: ${resultado}`;
    if (resultado === 'VALOR_DIVERGENTE' || resultado === 'APROVADO_APOS_ENCERRAMENTO') {
      this.logger.error(mensagem);
    } else {
      this.logger.log(mensagem);
    }
  }
}
