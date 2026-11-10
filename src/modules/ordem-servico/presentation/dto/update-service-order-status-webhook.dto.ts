import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as ordemServicoEntity from '../../domain/entities/ordem-servico.entity';

// DELIVERED fica de fora: a entrega só é gravada por PATCH /ordens-servico/:id/registrar-entrega.
const STATUS_ACEITOS_NO_WEBHOOK: ordemServicoEntity.OSStatus[] = [
  'RECEIVED',
  'UNDER_DIAGNOSIS',
  'AWAITING_APPROVAL',
  'IN_PROGRESS',
  'AWAITING_PARTS',
  'FINISHED',
  'CLOSED_WITHOUT_EXECUTION',
];

export class UpdateServiceOrderStatusWebhookDto {
  @ApiProperty({
    description: 'ID da Ordem de Serviço (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  osId!: string;

  @ApiProperty({
    description:
      'Novo status da Ordem de Serviço. DELIVERED não é aceito: use PATCH /ordens-servico/:id/registrar-entrega.',
    enum: STATUS_ACEITOS_NO_WEBHOOK,
    example: 'UNDER_DIAGNOSIS',
  })
  @IsEnum(STATUS_ACEITOS_NO_WEBHOOK)
  @IsNotEmpty()
  status!: ordemServicoEntity.OSStatus;

  @ApiPropertyOptional({
    description: 'Motivo ou observação da alteração de status',
    example: 'Veículo chegou na oficina e iniciou a triagem.',
  })
  @IsOptional()
  @IsString()
  motivo?: string;
}
