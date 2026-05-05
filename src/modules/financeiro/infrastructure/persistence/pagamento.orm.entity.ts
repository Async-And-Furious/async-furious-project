import { Pagamento } from '../../domain/entities/pagamento.entity';

// Interface que espelha exatamente a tabela do Prisma
export interface PagamentoORMEntity {
  id: string;
  ordemServicoId: string;
  valor: number;
  status: string;
  created_at: Date;
}

export class PagamentoMapper {
  static toDomain(orm: PagamentoORMEntity): Pagamento {
    // Reconstroi o Aggregate Root a partir dos dados do Prisma
    const pagamento = Object.create(Pagamento.prototype);
    // Atribui os campos privados via cast para manter o estado persistido
    pagamento.ordemServicoId = orm.ordemServicoId;
    pagamento.valor = Number(orm.valor);
    pagamento.id = orm.id;
    pagamento.status = orm.status;
    return pagamento;
  }

  static toOrm(pagamento: Pagamento): Omit<PagamentoORMEntity, 'created_at'> {
    // Transforma a Entidade de Domínio em um objeto que o Prisma aceita
    return {
      id: pagamento.getId(),
      ordemServicoId: (pagamento as any).ordemServicoId, // Usando cast para acessar campos privados
      valor: (pagamento as any).valor,
      status: pagamento.getStatus(),
    };
  }
}
