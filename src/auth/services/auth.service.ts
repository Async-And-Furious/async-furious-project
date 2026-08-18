import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { LoginDto, RegisterDto } from '../dto/auth.dto';
import { Role } from '../enums/role.enum';
import type { AuthenticatedUser, JwtPayload } from '../types/auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      this.logger.warn(`Registration attempt for existing email: ${email}`);
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

    this.logger.log(`New user registered: ${user.id}`);
    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Login attempt for non-existent email: ${email}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for user: ${user.id}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.logger.log(`User logged in: ${user.id}`);
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

  async validateTokenSubject(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.validateUser(payload.sub);
    if (user) return user;

    const documento = payload.cpf ?? payload.documento ?? payload.sub;
    const cliente = await this.prisma.cliente.findUnique({
      where: { documento },
      select: { id: true, email: true, ativo: true },
    });
    if (!cliente?.ativo) return null;

    return { id: cliente.id, email: cliente.email, role: Role.CLIENTE };
  }

  async findById(id: string) {
    return this.validateUser(id);
  }
}
