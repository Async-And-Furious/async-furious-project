import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';

describe('ServicosController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let authToken: string;
  let testServicoId: string;

  const testUser = {
    email: 'testadmin-servicos@example.com',
    password: 'admin123',
    name: 'Test Admin Servicos',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await prismaService.user.deleteMany({ where: { email: testUser.email } });
    await prismaService.servico.deleteMany({ where: { nome: { startsWith: 'E2E Servico' } } });

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = await prismaService.user.create({
      data: { ...testUser, password: hashedPassword },
    });

    authToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  afterAll(async () => {
    if (testServicoId) {
      await prismaService.servico.deleteMany({ where: { id: testServicoId } });
    }

    await prismaService.servico.deleteMany({ where: { nome: { startsWith: 'E2E Servico' } } });
    await prismaService.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  describe('POST /servicos', () => {
    it('should create a new servico', async () => {
      const createServicoDto = {
        nome: 'E2E Servico Lavagem',
        descricao: 'Lavagem completa',
        preco: 120.5,
      };

      const response = await request(app.getHttpServer())
        .post('/servicos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createServicoDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.nome).toBe(createServicoDto.nome);
      expect(response.body.descricao).toBe(createServicoDto.descricao);
      expect(Number(response.body.preco)).toBe(createServicoDto.preco);
      testServicoId = response.body.id;
    });

    it('should fail without auth token', async () => {
      const createServicoDto = {
        nome: 'E2E Servico sem auth',
        preco: 90,
      };

      await request(app.getHttpServer()).post('/servicos').send(createServicoDto).expect(401);
    });

    it('should fail with invalid data', async () => {
      const invalidDto = {
        nome: '',
        preco: -1,
      };

      await request(app.getHttpServer())
        .post('/servicos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /servicos', () => {
    it('should list servicos with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/servicos')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should list servicos with search', async () => {
      const response = await request(app.getHttpServer())
        .get('/servicos?search=Lavagem')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should list servicos with pagination params', async () => {
      const response = await request(app.getHttpServer())
        .get('/servicos?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /servicos/:id', () => {
    it('should get a servico by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/servicos/${testServicoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testServicoId);
      expect(response.body).toHaveProperty('nome');
    });

    it('should return 404 for nonexistent servico', async () => {
      await request(app.getHttpServer())
        .get('/servicos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /servicos/:id', () => {
    it('should update a servico', async () => {
      const updateDto = { nome: 'E2E Servico Lavagem Premium' };

      const response = await request(app.getHttpServer())
        .patch(`/servicos/${testServicoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.nome).toBe(updateDto.nome);
    });

    it('should update multiple fields', async () => {
      const updateDto = {
        nome: 'E2E Servico Polimento',
        descricao: 'Polimento técnico',
        preco: 350,
      };

      const response = await request(app.getHttpServer())
        .patch(`/servicos/${testServicoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.nome).toBe(updateDto.nome);
      expect(response.body.descricao).toBe(updateDto.descricao);
      expect(Number(response.body.preco)).toBe(updateDto.preco);
    });
  });

  describe('DELETE /servicos/:id', () => {
    let servicoToDeleteId: string;

    beforeEach(async () => {
      const servico = await prismaService.servico.create({
        data: {
          nome: 'E2E Servico Delete',
          descricao: 'Remover no teste',
          preco: 10,
        },
      });
      servicoToDeleteId = servico.id;
    });

    it('should delete a servico', async () => {
      await request(app.getHttpServer())
        .delete(`/servicos/${servicoToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/servicos/${servicoToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for nonexistent servico', async () => {
      await request(app.getHttpServer())
        .delete('/servicos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
