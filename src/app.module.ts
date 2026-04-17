import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { AuthModule } from './shared/auth/auth.module';
import { ClienteModule } from './modules/clientes/cliente.module';
import { VeiculoModule } from './modules/veiculos/veiculo.module';
import { OrdemDeServicoModule } from './modules/ordens-servico/ordem-de-servico.module';
import { PecaModule } from './modules/pecas/peca.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    ClienteModule,
    VeiculoModule,
    OrdemDeServicoModule,
    PecaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
