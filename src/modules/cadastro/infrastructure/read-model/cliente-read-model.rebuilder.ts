import { Inject, Injectable, Logger } from '@nestjs/common';
import { Db } from 'mongodb';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import type { ClienteORMEntity } from '../persistence/cliente.orm-entity';
import {
  CLIENTE_READ_MODEL_COLLECTION,
  READ_MODEL_DB,
} from '../../../../shared/infrastructure/read-model/read-model.config';
import {
  rebuildCollection,
  RebuildResult,
} from '../../../../shared/infrastructure/read-model/rebuild-collection';
import {
  buildClienteReadModelDocument,
  ClienteReadModelDocument,
} from './cliente-read-model.document';

const BATCH_SIZE = 500;

@Injectable()
export class ClienteReadModelRebuilder {
  private readonly logger = new Logger(ClienteReadModelRebuilder.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(READ_MODEL_DB) private readonly db: Db
  ) {}

  rebuild(): Promise<RebuildResult> {
    return rebuildCollection(
      this.db.collection<ClienteReadModelDocument>(CLIENTE_READ_MODEL_COLLECTION),
      { pages: this.pages(), existentes: (ids) => this.existentes(ids) }
    );
  }

  private async existentes(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.cliente.findMany({
      // Inativo (soft delete) conta como ausente: o rebuild remove o documento.
      where: { id: { in: ids }, ativo: true },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  private async *pages(): AsyncGenerator<ClienteReadModelDocument[]> {
    let lastId: string | undefined;
    for (;;) {
      const rows = await this.prisma.cliente.findMany({
        where: { ativo: true },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(lastId && { cursor: { id: lastId }, skip: 1 }),
      });
      if (rows.length === 0) return;
      yield rows.flatMap((row) => this.documentoOuPula(row));
      lastId = rows[rows.length - 1].id;
    }
  }

  // Uma linha que o domínio rejeita (ex.: CPF com dígito verificador inválido,
  // gravado antes da validação) não pode abortar o rebuild inteiro e travar o
  // deploy: a linha é pulada e o id vai para o log, sem o documento (LGPD).
  private documentoOuPula(row: ClienteORMEntity): ClienteReadModelDocument[] {
    try {
      return [buildClienteReadModelDocument(row)];
    } catch (error) {
      this.logger.warn(
        `Cliente ${row.id} fora do read model: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
}
