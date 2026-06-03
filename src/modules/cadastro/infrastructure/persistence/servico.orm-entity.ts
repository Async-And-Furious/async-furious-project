import { Prisma } from '@prisma/client';
import { Servico } from '../../domain/entities/servico.entity';

export interface ServicoORMEntity {
  id: string;
  nome: string;
  descricao: string | null;
  preco: Prisma.Decimal;
  created_at: Date;
  updated_at: Date;
}

export class ServicoMapper {
  static toDomain(orm: ServicoORMEntity): Servico {
    return Servico.reconstituir({
      id: orm.id,
      nome: orm.nome,
      descricao: orm.descricao,
      preco: Number(orm.preco),
      created_at: orm.created_at,
      updated_at: orm.updated_at,
    });
  }

  static toOrm(servico: Servico): Omit<ServicoORMEntity, 'created_at' | 'updated_at'> {
    return {
      id: servico.id,
      nome: servico.nome,
      descricao: servico.descricao,
      preco: new Prisma.Decimal(servico.preco),
    };
  }
}
