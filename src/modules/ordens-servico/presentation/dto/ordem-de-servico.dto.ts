import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';

export class CreateOrdemDeServicoDto {
  @IsUUID()
  @IsNotEmpty()
  vehicle_id: string;

  @IsUUID()
  @IsNotEmpty()
  customer_id: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateOrdemDeServicoDto {
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
  description?: string;
}

export class ListQueryDto {
  @IsOptional()
  page?: number;
  @IsOptional()
  limit?: number;
  @IsOptional()
  search?: string;
}
