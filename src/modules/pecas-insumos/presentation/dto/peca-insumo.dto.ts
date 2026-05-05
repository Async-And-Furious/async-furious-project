import { IsString, IsNotEmpty, IsOptional, IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePecaInsumoDto {
  @ApiProperty({ example: 'Filtro de Óleo', description: 'Nome da peça/insumo' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({ example: 'FO-001', description: 'Código único da peça' })
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiPropertyOptional({
    example: 'Filtro de óleo para motor 1.0',
    description: 'Descrição detalhada',
  })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiProperty({ example: 45.9, description: 'Preço unitário' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  preco: number;

  @ApiPropertyOptional({ example: 100, description: 'Quantidade em estoque' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantidade_estoque?: number;

  @ApiPropertyOptional({ example: 10, description: 'Quantidade mínima para alerta' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantidade_minima?: number;
}

export class UpdatePecaInsumoDto {
  @ApiPropertyOptional({ example: 'Filtro de Óleo Premium', description: 'Nome da peça' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ example: 'Filtro de óleo sintético', description: 'Descrição detalhada' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({ example: 59.9, description: 'Preço unitário' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  preco?: number;

  @ApiPropertyOptional({ example: 15, description: 'Quantidade mínima para alerta' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantidade_minima?: number;
}

export class UpdateEstoquePecaInsumoDto {
  @ApiProperty({ example: 50, description: 'Nova quantidade em estoque' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantidade: number;
}

export class ListQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Número da página' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10, description: 'Quantidade por página' })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'Filtro', description: 'Buscar por nome ou código' })
  @IsOptional()
  search?: string;
}

export class ItemSolicitacaoReposicaoDto {
  @ApiProperty({ example: 'uuid-da-peca', description: 'ID da peça' })
  @IsString()
  @IsNotEmpty()
  pecaId: string;

  @ApiProperty({ example: 50, description: 'Quantidade solicitada ao fornecedor' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantidadeSolicitada: number;
}

export class SolicitarReposicaoDto {
  @ApiProperty({ example: 'uuid-do-fornecedor', description: 'ID do fornecedor' })
  @IsString()
  @IsNotEmpty()
  fornecedorId: string;

  @ApiProperty({
    type: [ItemSolicitacaoReposicaoDto],
    description: 'Lista de peças para solicitar',
  })
  @IsNotEmpty()
  pecas: ItemSolicitacaoReposicaoDto[];
}
