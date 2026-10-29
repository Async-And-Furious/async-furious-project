import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ReadModelFailureReporter } from '../../../../shared/infrastructure/read-model/read-model-failure.reporter';
import {
  CLIENTE_READ_MODEL_COLLECTION,
  READ_MODEL_DB,
} from '../../../../shared/infrastructure/read-model/read-model.config';
import {
  buildClienteReadModelDocument,
  ClienteReadModelDocument,
} from './cliente-read-model.document';
import type { IClienteReadModelProjector } from '../../domain/interfaces/cliente-read-model.interface';

@Injectable()
export class ClienteReadModelProjector implements IClienteReadModelProjector {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(READ_MODEL_DB) private readonly db: Db,
    private readonly failureReporter: ReadModelFailureReporter
  ) {}

  async project(clienteId: string): Promise<void> {
    try {
      const collection = this.db.collection<ClienteReadModelDocument>(
        CLIENTE_READ_MODEL_COLLECTION
      );
      const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) {
        await collection.deleteOne({ _id: clienteId });
        return;
      }
      await collection.replaceOne({ _id: cliente.id }, buildClienteReadModelDocument(cliente), {
        upsert: true,
      });
    } catch (error) {
      this.failureReporter.report(CLIENTE_READ_MODEL_COLLECTION, clienteId, error);
    }
  }
}
