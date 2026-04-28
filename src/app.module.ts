import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { AuthModule } from './auth/auth.module';
import { CadastroModule } from './modules/cadastro/cadastro.module';
import { PecasInsumosModule } from './modules/pecas-insumos/pecas-insumos.module';
import { OrdemServicoModule } from './modules/ordem-servico/ordem-servico.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    CadastroModule,
    PecasInsumosModule,
    OrdemServicoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
