import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, IsNumber, Min } from 'class-validator';

export class CreateOrdemServicoDto {
  @IsUUID()
  @IsNotEmpty()
  id_veiculo: string;

  @IsUUID()
  @IsNotEmpty()
  id_cliente: string;

  @IsString()
  @IsOptional()
  descricao?: string;
}

export class UpdateOrdemServicoDto {
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

  @IsString()
  @IsOptional()
  descricao?: string;
}

export class ListQueryDto {
  @IsOptional()
  page?: number;
  @IsOptional()
  limit?: number;
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
