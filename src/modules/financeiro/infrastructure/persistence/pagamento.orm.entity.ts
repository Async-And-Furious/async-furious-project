import { Prisma } from '@prisma/client';
import { Pagamento } from '../../domain/entities/pagamento.entity';

// Interface que espelha exatamente a tabela do Prisma
export interface PagamentoORMEntity {
  id: string;
  ordemServicoId: string;
  valor: Prisma.Decimal;
  status: string;
  preferenceId: string | null;
  linkPagamento: string | null;
  createdAt: Date;
}

export class PagamentoMapper {
  static toDomain(orm: PagamentoORMEntity): Pagamento {
    return Pagamento.reconstituir({
      id: orm.id,
      ordemServicoId: orm.ordemServicoId,
      valor: Number(orm.valor),
      status: orm.status,
      preferenceId: orm.preferenceId,
      linkPagamento: orm.linkPagamento,
    });
  }

  static toOrm(pagamento: Pagamento): Omit<PagamentoORMEntity, 'createdAt'> {
    return {
      id: pagamento.getId(),
      ordemServicoId: pagamento.getOrdemServicoId(),
      valor: new Prisma.Decimal(pagamento.getValor()),
      status: pagamento.getStatus(),
      preferenceId: pagamento.getPreferenceId(),
      linkPagamento: pagamento.getLinkPagamento(),
    };
  }
}
