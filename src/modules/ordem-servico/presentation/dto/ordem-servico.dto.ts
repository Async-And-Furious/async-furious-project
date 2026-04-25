import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';

export class CreateOrdemServicoDto {
  @IsUUID()
  @IsNotEmpty()
  veiculoId: string;

  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

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
