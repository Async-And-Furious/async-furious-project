import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, Min, Max } from 'class-validator';

export class CreateVeiculoDto {
  @IsString()
  @IsNotEmpty()
  placa: string;

  @IsString()
  @IsNotEmpty()
  marca: string;

  @IsString()
  @IsNotEmpty()
  modelo: string;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  ano: number;

  @IsString()
  @IsOptional()
  cor?: string;

  @IsUUID()
  @IsNotEmpty()
  id_cliente: string;
}

export class UpdateVeiculoDto {
  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  modelo?: string;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  @IsOptional()
  ano?: number;

  @IsString()
  @IsOptional()
  cor?: string;
}

export class ListQueryDto {
  @IsOptional()
  page?: number;
  @IsOptional()
  limit?: number;
  @IsOptional()
  search?: string;
}
