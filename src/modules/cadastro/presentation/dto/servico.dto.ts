import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServicoDto {
  @ApiProperty({
    example: 'Lavagem completa',
    description: 'Nome do servico',
    minLength: 3,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({
    example: 'Lavagem interna e externa com aspiracao',
    description: 'Descricao detalhada do servico',
    required: false,
  })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiProperty({
    example: 120.5,
    description: 'Preco do servico',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  preco: number;
}

export class UpdateServicoDto {
  @ApiProperty({
    example: 'Lavagem premium',
    description: 'Novo nome do servico',
    required: false,
  })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiProperty({
    example: 'Lavagem completa com cera e higienizacao interna',
    description: 'Nova descricao do servico',
    required: false,
  })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiProperty({
    example: 250,
    description: 'Novo preco do servico',
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  preco?: number;
}

export class ListQueryDto {
  @ApiProperty({
    example: 1,
    description: 'Numero da pagina',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    example: 10,
    description: 'Quantidade de registros por pagina',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    example: 'Lavagem',
    description: 'Buscar por nome ou descricao do servico',
    required: false,
  })
  @IsOptional()
  search?: string;
}
