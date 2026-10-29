import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { UpdateServiceOrderStatusUseCase } from '../../application/use-cases/update-service-order-status.use-case';
import { UpdateServiceOrderStatusWebhookDto } from '../dto/update-service-order-status-webhook.dto';
import { WebhookAuthGuard } from '../../../../auth/guards/webhook-auth.guard';

@ApiTags('Webhooks')
@ApiBearerAuth()
@ApiSecurity('webhook-secret')
@Controller('webhooks/service-orders')
export class ServiceOrderStatusWebhookController {
  constructor(private readonly updateServiceOrderStatusUseCase: UpdateServiceOrderStatusUseCase) {}

  @UseGuards(WebhookAuthGuard)
  @Post('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprocessar manualmente o status da OS (canal de exceção)',
    description:
      'Canal de reprocesso manual. O caminho normal de mudança de status são os eventos da saga. Exige o header x-webhook-secret e passa pelo authorizer da borda. A transição é validada pela mesma máquina de estados dos consumidores de evento; DELIVERED é rejeitado.',
  })
  @ApiResponse({ status: 200, description: 'Status da OS atualizado com sucesso.' })
  @ApiResponse({
    status: 400,
    description: 'Transição de status inválida (inclui DELIVERED) ou dados incorretos.',
  })
  @ApiResponse({ status: 401, description: 'Header x-webhook-secret ausente ou inválido.' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada.' })
  async handleStatusUpdate(@Body() dto: UpdateServiceOrderStatusWebhookDto): Promise<void> {
    await this.updateServiceOrderStatusUseCase.execute(dto.osId, dto.status, dto.motivo);
  }
}
