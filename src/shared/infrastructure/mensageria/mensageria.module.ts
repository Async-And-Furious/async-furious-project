import { Global, Module } from '@nestjs/common';
import { PUBLICADOR_INTEGRACAO } from '../../domain/interfaces/publicador-integracao.interface';
import { KafkaPublicadorIntegracao } from './kafka-publicador-integracao';

@Global()
@Module({
  providers: [
    { provide: PUBLICADOR_INTEGRACAO, useFactory: () => new KafkaPublicadorIntegracao() },
  ],
  exports: [PUBLICADOR_INTEGRACAO],
})
export class MensageriaModule {}
