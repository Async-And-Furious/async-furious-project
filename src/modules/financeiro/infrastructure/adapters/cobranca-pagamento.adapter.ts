import { Injectable } from '@nestjs/common';
import type { ICobrancaPagamentoPort } from '@/shared/domain/interfaces/cobranca-pagamento.port';
import { CriarCobrancaUseCase } from '../../application/use-cases/criar-cobranca.use-case';

@Injectable()
export class CobrancaPagamentoAdapter implements ICobrancaPagamentoPort {
  constructor(private readonly criarCobrancaUseCase: CriarCobrancaUseCase) {}

  gerarLinkPagamento(ordemServicoId: string, valor: number): Promise<string> {
    return this.criarCobrancaUseCase.execute({ ordemServicoId, valor });
  }
}
