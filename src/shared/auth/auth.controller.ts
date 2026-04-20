import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './services/auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
@ApiTags('Autenticação')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar novo usuário',
    description: 'Cria um novo usuário no sistema',
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
        },
      },
      'Exemplo User': {
        value: {
          email: 'user@example.com',
          password: 'senha123456',
          name: 'Regular User',
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
    status: 429,
    description: 'Muitas tentativas - aguarde antes de tentar novamente',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
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
