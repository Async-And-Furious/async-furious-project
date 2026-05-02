// src/modules/financeiro/presentation/controllers/pagamento.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { RegistrarPagamentoPolicy } from '../../application/policies/registrar-pagamento.policy';
import { RegistrarPagamentoDto } from '../dto/registrar-pagamento.dto';

@Controller('pagamentos')
export class PagamentoController {
  // Injeta a Policy diretamente, como se fosse um UseCase
  constructor(private readonly registrarPagamentoPolicy: RegistrarPagamentoPolicy) {}

  @Post('registrar')
  async registrar(@Body() dto: RegistrarPagamentoDto) {
    // Passa o DTO validado para a Policy executar
    await this.registrarPagamentoPolicy.execute({
      ordemServicoId: dto.ordemServicoId,
      valor: dto.valor,
    });

    return { message: 'Pagamento registrado com sucesso' };
  }
}
