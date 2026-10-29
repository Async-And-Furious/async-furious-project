import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  OS_READ_MODEL_COLLECTION,
  READ_MODEL_DB,
} from '../../../../shared/infrastructure/read-model/read-model.config';
import {
  rebuildCollection,
  RebuildResult,
} from '../../../../shared/infrastructure/read-model/rebuild-collection';
import {
  buildOsReadModelDocument,
  OS_PROJECAO_INCLUDE,
  OsReadModelDocument,
} from './os-read-model.document';

const BATCH_SIZE = 500;

@Injectable()
export class OsReadModelRebuilder {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(READ_MODEL_DB) private readonly db: Db
  ) {}

  rebuild(): Promise<RebuildResult> {
    return rebuildCollection(
      this.db.collection<OsReadModelDocument>(OS_READ_MODEL_COLLECTION),
      this.pages()
    );
  }

  private async *pages(): AsyncGenerator<OsReadModelDocument[]> {
    let lastId: string | undefined;
    for (;;) {
      const rows = await this.prisma.ordemServico.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(lastId && { cursor: { id: lastId }, skip: 1 }),
        include: OS_PROJECAO_INCLUDE,
      });
      if (rows.length === 0) return;
      yield rows.map(buildOsReadModelDocument);
      lastId = rows[rows.length - 1].id;
    }
  }
}
