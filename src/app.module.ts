import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './modules/infrastructure/database/database.module';
import { AuthModule } from './modules/infrastructure/auth/auth.module';
import { CustomerModule } from './modules/domain/customers/customer.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule, CustomerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
