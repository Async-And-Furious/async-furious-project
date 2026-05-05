import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClienteDto {
  @ApiProperty({
    example: 'João Silva',
    description: 'Nome completo do cliente',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({
    example: 'joao@example.com',
    description: 'Email do cliente (único)',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '11999999999',
    description: 'Telefone do cliente',
    required: false,
  })
  @IsString()
  @IsOptional()
  telefone?: string;

  @ApiProperty({
    example: '12345678901',
    description: 'CPF ou CNPJ',
    minLength: 11,
    maxLength: 14,
  })
  @IsString()
  @IsNotEmpty()
  documento: string;

  @ApiProperty({
    example: 'CPF',
    enum: ['CPF', 'CNPJ'],
    description: 'Tipo de documento fiscal',
  })
  @IsEnum(['CPF', 'CNPJ'])
  tipoDocumento: 'CPF' | 'CNPJ';
}

export class UpdateClienteDto {
  @ApiProperty({
    example: 'João Silva Updated',
    description: 'Novo nome do cliente',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nome?: string;

  @ApiProperty({
    example: 'newemail@example.com',
    description: 'Novo email do cliente',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '11988888888',
    description: 'Novo telefone do cliente',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  telefone?: string;
}

export class ListQueryDto {
  @ApiProperty({
    example: 1,
    description: 'Número da página',
    required: false,
  })
  @IsOptional()
  page?: number;

  @ApiProperty({
    example: 10,
    description: 'Quantidade de registros por página',
    required: false,
  })
  @IsOptional()
  limit?: number;

  @ApiProperty({
    example: 'João',
    description: 'Buscar por nome do cliente',
    required: false,
  })
  @IsOptional()
  search?: string;
}
