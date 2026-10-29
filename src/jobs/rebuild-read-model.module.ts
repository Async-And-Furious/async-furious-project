import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/infrastructure/database/database.module';
import { ReadModelModule } from '../shared/infrastructure/read-model/read-model.module';
import { OsReadModelRebuilder } from '../modules/ordem-servico/infrastructure/read-model/os-read-model.rebuilder';
import { ClienteReadModelRebuilder } from '../modules/cadastro/infrastructure/read-model/cliente-read-model.rebuilder';

@Module({
  imports: [DatabaseModule, ReadModelModule],
  providers: [OsReadModelRebuilder, ClienteReadModelRebuilder],
})
export class RebuildReadModelModule {}
