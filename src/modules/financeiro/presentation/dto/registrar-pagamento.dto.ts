import { IsNumber, IsUUID, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistrarPagamentoDto {
  @ApiProperty({
    example: 'uuid-da-ordem-de-servico',
    description: 'ID da Ordem de Serviço vinculada ao pagamento',
  })
  @IsUUID()
  ordemServicoId!: string;

  @ApiProperty({
    example: 150.5,
    description: 'Valor a ser registrado para o pagamento',
  })
  @IsNumber()
  @IsPositive()
  valor!: number;
}
