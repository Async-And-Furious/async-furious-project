import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  tax_id: string;

  @IsEnum(['CPF', 'CNPJ'])
  tax_id_type: 'CPF' | 'CNPJ';
}

export class UpdateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
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
