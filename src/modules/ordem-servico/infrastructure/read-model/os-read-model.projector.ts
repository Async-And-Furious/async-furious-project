import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ReadModelFailureReporter } from '../../../../shared/infrastructure/read-model/read-model-failure.reporter';
import {
  OS_READ_MODEL_COLLECTION,
  READ_MODEL_DB,
} from '../../../../shared/infrastructure/read-model/read-model.config';
import {
  isDuplicateKeyError,
  versionFilter,
} from '../../../../shared/infrastructure/read-model/version-guard';
import {
  buildOsReadModelDocument,
  OS_PROJECAO_INCLUDE,
  OsReadModelDocument,
} from './os-read-model.document';
import type { IOsReadModelProjector } from '../../domain/interfaces/os-read-model.interface';

@Injectable()
export class OsReadModelProjector implements IOsReadModelProjector {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(READ_MODEL_DB) private readonly db: Db,
    private readonly failureReporter: ReadModelFailureReporter
  ) {}

  async project(ordemServicoId: string): Promise<void> {
    try {
      const collection = this.db.collection<OsReadModelDocument>(OS_READ_MODEL_COLLECTION);
      const os = await this.prisma.ordemServico.findUnique({
        where: { id: ordemServicoId },
        include: OS_PROJECAO_INCLUDE,
      });
      if (!os) {
        await collection.deleteOne({ _id: ordemServicoId });
        return;
      }
      const doc = buildOsReadModelDocument(os);
      // Só aceita snapshot igual ou mais novo: duas projeções concorrentes da
      // mesma OS não deixam o estado antigo por último. E11000 = já há
      // documento mais novo, no-op.
      await collection.replaceOne(versionFilter(doc), doc, { upsert: true });
    } catch (error) {
      if (isDuplicateKeyError(error)) return;
      this.failureReporter.report(OS_READ_MODEL_COLLECTION, ordemServicoId, error);
    }
  }
}
