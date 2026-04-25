import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrdemServicoDto {
  @ApiProperty({ example: 'uuid-do-veiculo', description: 'ID do veículo' })
  @IsUUID()
  @IsNotEmpty()
  veiculoId: string;

  @ApiProperty({ example: 'uuid-do-cliente', description: 'ID do cliente' })
  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

  @ApiPropertyOptional({
    example: 'Troca de óleo e revisão completa',
    description: 'Descrição do serviço',
  })
  @IsString()
  @IsOptional()
  descricao?: string;
}

export class UpdateOrdemServicoDto {
  @ApiPropertyOptional({
    enum: [
      'RECEIVED',
      'UNDER_DIAGNOSIS',
      'AWAITING_APPROVAL',
      'IN_PROGRESS',
      'FINISHED',
      'DELIVERED',
    ],
    example: 'IN_PROGRESS',
    description: 'Novo status da ordem de serviço',
  })
  @IsEnum([
    'RECEIVED',
    'UNDER_DIAGNOSIS',
    'AWAITING_APPROVAL',
    'IN_PROGRESS',
    'FINISHED',
    'DELIVERED',
  ])
  @IsOptional()
  status?:
    | 'RECEIVED'
    | 'UNDER_DIAGNOSIS'
    | 'AWAITING_APPROVAL'
    | 'IN_PROGRESS'
    | 'FINISHED'
    | 'DELIVERED';

  @ApiPropertyOptional({
    example: 'Serviço iniciado - troca de óleo em andamento',
    description: 'Nova descrição',
  })
  @IsString()
  @IsOptional()
  descricao?: string;
}

export class ListQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Número da página' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10, description: 'Quantidade por página' })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'troca', description: 'Buscar por descrição' })
  @IsOptional()
  search?: string;
}

export class GerarOrcamentoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor_total_servicos: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor_total_pecas: number;
}
