import { Controller, Post, Body } from '@nestjs/common';
import { RegistrarPagamentoUseCase } from '../../application/use-cases/registrar-pagamento.use-case';
import { RegistrarPagamentoDto } from '../dto/registrar-pagamento.dto';

@Controller('pagamentos')
export class PagamentoController {
  constructor(private readonly registrarPagamentoUseCase: RegistrarPagamentoUseCase) {}

  @Post('registrar')
  async registrar(@Body() dto: RegistrarPagamentoDto) {
    await this.registrarPagamentoUseCase.execute({
      ordemServicoId: dto.ordemServicoId,
      valor: dto.valor,
    });

    return { message: 'Pagamento registrado com sucesso' };
  }
}
