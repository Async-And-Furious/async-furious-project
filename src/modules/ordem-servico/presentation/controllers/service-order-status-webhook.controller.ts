import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateServiceOrderStatusUseCase } from '../../application/use-cases/update-service-order-status.use-case';
import { UpdateServiceOrderStatusWebhookDto } from '../dto/update-service-order-status-webhook.dto';

@ApiTags('Webhooks')
@Controller('webhooks/service-orders')
export class ServiceOrderStatusWebhookController {
  constructor(
    private readonly updateServiceOrderStatusUseCase: UpdateServiceOrderStatusUseCase
  ) {}

  @Post('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receber atualização de status da OS de sistema externo',
    description:
      'Endpoint utilizado para integrar sistemas de terceiros (oficina) que necessitam atualizar o status da OS, simulando uma integração por webhook.',
  })
  @ApiResponse({ status: 200, description: 'Status da OS atualizado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Transição de status inválida ou dados incorretos.' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada.' })
  async handleStatusUpdate(@Body() dto: UpdateServiceOrderStatusWebhookDto): Promise<void> {
    await this.updateServiceOrderStatusUseCase.execute(dto.osId, dto.status, dto.motivo);
  }
}
