import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './services/auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { Role } from './enums/role.enum';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
@ApiTags('Autenticação')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registrar novo usuário (ADMIN only)',
    description: 'Cria um novo usuário no sistema. Apenas ADMIN pode criar usuários.',
  })
  @ApiBody({
    type: RegisterDto,
    description: 'Dados do novo usuário',
    examples: {
      'Exemplo Admin': {
        value: {
          email: 'admin@example.com',
          password: 'senha123456',
          name: 'Admin User',
          role: 'ADMIN',
        },
      },
      'Exemplo User': {
        value: {
          email: 'user@example.com',
          password: 'senha123456',
          name: 'Regular User',
          role: 'RECEPCIONISTA',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Usuário registrado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Validação falhou - email já existe ou dados inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido ou expirado',
  })
  @ApiResponse({
    status: 403,
    description: 'Apenas ADMIN pode criar usuários',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas - aguarde antes de tentar novamente',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fazer login',
    description: 'Autentica um usuário e retorna um token JWT',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Credenciais do usuário',
    examples: {
      'Exemplo Login': {
        value: {
          email: 'admin@example.com',
          password: 'senha123456',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso - token retornado',
  })
  @ApiResponse({
    status: 400,
    description: 'Credenciais inválidas ou formato incorreto',
  })
  @ApiResponse({
    status: 401,
    description: 'Email ou senha incorretos',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas de login - aguarde antes de tentar novamente',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
