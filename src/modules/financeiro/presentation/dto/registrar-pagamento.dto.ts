import { IsNumber, IsOptional, IsUUID, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistrarPagamentoDto {
  @ApiProperty({
    example: 'uuid-da-ordem-de-servico',
    description: 'ID da Ordem de Serviço vinculada ao pagamento',
  })
  @IsUUID()
  ordemServicoId!: string;

  @ApiPropertyOptional({
    example: 150.5,
    description:
      'Ignorado: o valor vem da cobrança do Mercado Pago. Mantido opcional por compatibilidade.',
    deprecated: true,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  valor?: number;
}
