import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(READ_MODEL_DB) private readonly db: Db
  ) {}

  rebuild(): Promise<RebuildResult> {
    return rebuildCollection(
      this.db.collection<ClienteReadModelDocument>(CLIENTE_READ_MODEL_COLLECTION),
      this.pages()
    );
  }

  private async *pages(): AsyncGenerator<ClienteReadModelDocument[]> {
    let lastId: string | undefined;
    for (;;) {
      const rows = await this.prisma.cliente.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(lastId && { cursor: { id: lastId }, skip: 1 }),
      });
      if (rows.length === 0) return;
      yield rows.map(buildClienteReadModelDocument);
      lastId = rows[rows.length - 1].id;
    }
  }
}
