import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVeiculoDto {
  @ApiProperty({
    example: 'ABC-1234',
    description: 'Placa do veículo (formato ABC-1234 ou ABC1D23)',
  })
  @IsString()
  @IsNotEmpty()
  placa: string;

  @ApiProperty({ example: 'Toyota', description: 'Marca do veículo' })
  @IsString()
  @IsNotEmpty()
  marca: string;

  @ApiProperty({ example: 'Corolla', description: 'Modelo do veículo' })
  @IsString()
  @IsNotEmpty()
  modelo: string;

  @ApiProperty({ example: 2024, description: 'Ano de fabricação' })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  ano: number;

  @ApiPropertyOptional({ example: 'Prata', description: 'Cor do veículo' })
  @IsString()
  @IsOptional()
  cor?: string;

  @ApiProperty({ example: 'uuid-do-cliente', description: 'ID do cliente proprietario' })
  @IsUUID()
  @IsNotEmpty()
  clienteId: string;
}

export class UpdateVeiculoDto {
  @ApiPropertyOptional({ example: 'Honda', description: 'Nova marca' })
  @IsString()
  @IsOptional()
  marca?: string;

  @ApiPropertyOptional({ example: 'Civic', description: 'Novo modelo' })
  @IsString()
  @IsOptional()
  modelo?: string;

  @ApiPropertyOptional({ example: 2025, description: 'Novo ano de fabricação' })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  @IsOptional()
  ano?: number;

  @ApiPropertyOptional({ example: 'Preto', description: 'Nova cor' })
  @IsString()
  @IsOptional()
  cor?: string;
}

export class ListQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Número da página' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10, description: 'Quantidade por página' })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'Toyota', description: 'Buscar por placa, marca ou modelo' })
  @IsOptional()
  search?: string;
}
