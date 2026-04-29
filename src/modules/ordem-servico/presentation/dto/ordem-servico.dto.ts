import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
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

export class ItemPecaDto {
  @ApiProperty({ example: 'uuid-da-peca', description: 'ID da peça' })
  @IsUUID()
  id_peca: string;

  @ApiProperty({ example: 2, description: 'Quantidade utilizada' })
  @IsInt()
  @IsPositive()
  quantidade: number;

  @ApiProperty({ example: 150.0, description: 'Preço unitário da peça' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preco_unitario: number;
}

export class GerarOrcamentoDto {
  @ApiProperty({ example: 300.0, description: 'Valor total dos serviços' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor_total_servicos: number;

  @ApiProperty({ example: 150.0, description: 'Valor total das peças' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor_total_pecas: number;

  @ApiPropertyOptional({ type: [ItemPecaDto], description: 'Peças utilizadas na OS' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPecaDto)
  pecas?: ItemPecaDto[];
}
