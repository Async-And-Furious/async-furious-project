import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive,
  IsEmail,
  IsEnum,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OsClienteDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({ example: 'joao@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsString()
  @IsOptional()
  telefone?: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  documento: string;

  @ApiProperty({ enum: ['CPF', 'CNPJ'] })
  @IsEnum(['CPF', 'CNPJ'])
  tipoDocumento: 'CPF' | 'CNPJ';
}

export class OsVeiculoDto {
  @ApiProperty({ example: 'ABC-1234' })
  @IsString()
  @IsNotEmpty()
  placa: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  marca: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  @IsNotEmpty()
  modelo: string;

  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  ano: number;

  @ApiPropertyOptional({ example: 'Prata' })
  @IsString()
  @IsOptional()
  cor?: string;
}

export class OsServicoItemDto {
  @ApiProperty({ example: 'uuid-do-servico' })
  @IsUUID()
  id_servico: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  quantidade: number;
}

export class OsPecaItemDto {
  @ApiProperty({ example: 'uuid-da-peca' })
  @IsUUID()
  id_peca: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  quantidade: number;
}

export class CreateOrdemServicoDto {
  @ApiProperty({ type: OsClienteDto, description: 'Dados do cliente' })
  @ValidateNested()
  @Type(() => OsClienteDto)
  @IsNotEmpty()
  cliente: OsClienteDto;

  @ApiProperty({ type: OsVeiculoDto, description: 'Dados do veículo' })
  @ValidateNested()
  @Type(() => OsVeiculoDto)
  @IsNotEmpty()
  veiculo: OsVeiculoDto;

  @ApiProperty({ type: [OsServicoItemDto], description: 'Serviços solicitados' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OsServicoItemDto)
  servicos: OsServicoItemDto[];

  @ApiProperty({ type: [OsPecaItemDto], description: 'Peças e insumos utilizados' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OsPecaItemDto)
  pecas: OsPecaItemDto[];

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
    enum: ['RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'],
    example: 'AWAITING_APPROVAL',
    description: 'Novo status da ordem de serviço',
  })
  @IsIn(['RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'])
  @IsOptional()
  status?: 'RECEIVED' | 'UNDER_DIAGNOSIS' | 'AWAITING_APPROVAL';

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

export class NotificacaoAprovacaoOrcamentoDto {
  @ApiProperty({
    enum: ['APROVADO', 'RECUSADO'],
    example: 'APROVADO',
    description: 'Decisão do cliente sobre o orçamento',
  })
  @IsIn(['APROVADO', 'RECUSADO'])
  @IsNotEmpty()
  decisao: 'APROVADO' | 'RECUSADO';
}
