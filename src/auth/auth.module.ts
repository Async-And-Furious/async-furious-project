import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const gatewayMode = config.get<string>('AUTH_MODE') === 'gateway';
        const key = gatewayMode
          ? config.get<string>('JWT_PUBLIC_KEY')
          : config.get<string>('JWT_SECRET');
        if (!key) {
          throw new Error(
            gatewayMode
              ? 'JWT_PUBLIC_KEY environment variable is required'
              : 'JWT_SECRET environment variable is required'
          );
        }
        return {
          secret: key,
          verifyOptions: { algorithms: [gatewayMode ? 'RS256' : 'HS256'] },
          signOptions: { expiresIn: '1h' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, WebhookAuthGuard],
  exports: [AuthService, JwtStrategy, PassportModule, JwtAuthGuard, RolesGuard, WebhookAuthGuard],
})
export class AuthModule {}
