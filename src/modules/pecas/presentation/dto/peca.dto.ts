import { IsString, IsNotEmpty, IsOptional, IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePecaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  preco: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantidade_estoque?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantidade_minima?: number;
}

export class UpdatePecaDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  preco?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantidade_minima?: number;
}

export class UpdateEstoqueDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantidade: number;
}

export class ListQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  search?: string;
}
