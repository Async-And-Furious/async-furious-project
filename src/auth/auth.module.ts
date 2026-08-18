import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const algorithm = (config.get<string>('JWT_ALGORITHM') ?? 'HS256') as 'HS256' | 'RS256';
        const secret =
          algorithm === 'RS256'
            ? config.get<string>('JWT_PRIVATE_KEY')
            : config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT signing key environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '1h', algorithm },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtStrategy, PassportModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
