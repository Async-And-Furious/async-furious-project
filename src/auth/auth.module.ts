import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtCustomerStrategy } from './strategies/jwt-customer.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtCustomerAuthGuard } from './guards/jwt-customer-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';
import { createJwtModuleOptions } from './jwt.config';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createJwtModuleOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtCustomerStrategy,
    JwtAuthGuard,
    JwtCustomerAuthGuard,
    RolesGuard,
    WebhookAuthGuard,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    JwtCustomerStrategy,
    PassportModule,
    JwtAuthGuard,
    JwtCustomerAuthGuard,
    RolesGuard,
    WebhookAuthGuard,
  ],
})
export class AuthModule {}
