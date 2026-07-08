import { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

export async function createTestUser(
  prismaService: PrismaService,
  jwtService: JwtService,
  userData: TestUser
): Promise<{ user: TestUser; token: string }> {
  await prismaService.user.deleteMany({ where: { email: userData.email } });
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const user = await prismaService.user.create({
    data: { ...userData, password: hashedPassword },
  });
  const token = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  return { user, token };
}

export async function createAdminToken(
  prismaService: PrismaService,
  jwtService: JwtService,
  email: string
): Promise<string> {
  const adminData = {
    email,
    password: 'admin123',
    name: 'Admin',
    role: 'ADMIN',
  };
  await prismaService.user.deleteMany({ where: { email } });
  const hashedPassword = await bcrypt.hash(adminData.password, 10);
  const admin = await prismaService.user.create({
    data: { ...adminData, password: hashedPassword },
  });
  return jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
}

export async function cleanupTestUser(prismaService: PrismaService, email: string): Promise<void> {
  await prismaService.user.deleteMany({ where: { email } });
}

export async function cleanupTestCliente(
  prismaService: PrismaService,
  clienteId: string | undefined
): Promise<void> {
  if (clienteId) {
    await prismaService.veiculo.deleteMany({ where: { id_cliente: clienteId } });
    await prismaService.cliente.deleteMany({ where: { id: clienteId } });
  }
}
