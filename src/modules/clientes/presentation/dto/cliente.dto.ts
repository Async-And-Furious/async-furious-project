import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  tax_id: string;

  @IsEnum(['CPF', 'CNPJ'])
  tax_id_type: 'CPF' | 'CNPJ';
}

export class UpdateClienteDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  phone?: string;
}

export class ListQueryDto {
  @IsOptional()
  page?: number;
  @IsOptional()
  limit?: number;
  @IsOptional()
  search?: string;
}
