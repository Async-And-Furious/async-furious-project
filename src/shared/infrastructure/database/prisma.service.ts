import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL ?? PrismaService.databaseUrlFromContract();
    super({ datasources: { db: { url } } });
  }

  private static databaseUrlFromContract(): string {
    const {
      DB_HOST,
      DB_PORT = '5432',
      DB_NAME,
      DB_USER,
      DB_PASSWORD,
      DB_SSLMODE = 'require',
    } = process.env;
    if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
      throw new Error(
        'DATABASE_URL or the explicit DB_HOST/DB_NAME/DB_USER/DB_PASSWORD contract is required'
      );
    }
    return `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}`;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
