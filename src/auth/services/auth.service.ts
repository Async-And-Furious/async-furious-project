import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { LoginDto, RegisterDto } from '../dto/auth.dto';
import { Role } from '../enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto, correlationId = 'unknown') {
    if (this.config.get<string>('AUTH_MODE') === 'gateway') {
      throw new UnauthorizedException('Cadastro local indisponível neste ambiente');
    }
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      this.log('registration_rejected', correlationId, { reason: 'email_exists' });
      throw new ConflictException('E-mail já cadastrado');
    }

    const saltRounds = Number(this.config.get<number>('BCRYPT_SALT_ROUNDS') ?? '10');
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: dto.name.trim(),
        role: dto.role ?? Role.RECEPCIONISTA,
      },
    });

    this.log('user_registered', correlationId, { userId: user.id });
    return this.generateToken(user);
  }

  async login(dto: LoginDto, correlationId = 'unknown') {
    if (this.config.get<string>('AUTH_MODE') === 'gateway') {
      throw new UnauthorizedException('Login local indisponível neste ambiente');
    }
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.log('login_rejected', correlationId, { reason: 'user_not_found' });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      this.log('login_rejected', correlationId, { reason: 'invalid_password', userId: user.id });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.log('user_logged_in', correlationId, { userId: user.id });
    return this.generateToken(user);
  }

  private generateToken(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role as Role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) return null;
    return { id: user.id, email: user.email, role: user.role as Role };
  }

  async validateCustomer(customerId: string) {
    const customer = await this.prisma.cliente.findFirst({
      where: { id: customerId, ativo: true },
      select: { id: true, email: true },
    });
    if (!customer) return null;
    return { id: customer.id, email: customer.email, role: Role.RECEPCIONISTA };
  }

  async findById(id: string) {
    return this.validateUser(id);
  }

  private log(event: string, correlationId: string, fields: Record<string, unknown>): void {
    process.stdout.write(`${JSON.stringify({ event, correlationId, ...fields })}\n`);
  }
}
