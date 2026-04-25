import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

describe('ClientesController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let authToken: string;
  let testClienteId: string;

  const testUser = {
    email: 'testadmin@example.com',
    password: 'admin123',
    name: 'Test Admin',
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

    await prismaService.user.deleteMany({});
    await prismaService.ordemServico.deleteMany({});
    await prismaService.veiculo.deleteMany({});
    await prismaService.cliente.deleteMany({});

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = await prismaService.user.create({
      data: { ...testUser, password: hashedPassword },
    });

    authToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  afterAll(async () => {
    if (testClienteId) {
      await prismaService.cliente.deleteMany({ where: { id: testClienteId } });
    }
    await prismaService.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  describe('POST /clientes', () => {
    it('should create a new cliente', async () => {
      const createClienteDto = {
        nome: 'Test Client',
        email: 'testclient@example.com',
        telefone: '11999999999',
        documento: '52998224725',
        tipoDocumento: 'CPF',
      };

      const response = await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createClienteDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.nome).toBe('Test Client');
      expect(response.body.email).toBe('testclient@example.com');
      testClienteId = response.body.id;
    });

    it('should fail without auth token', async () => {
      const createClienteDto = {
        nome: 'Test Client',
        email: 'test2@example.com',
        documento: '52998224726',
        tipoDocumento: 'CPF',
      };

      await request(app.getHttpServer()).post('/clientes').send(createClienteDto).expect(401);
    });

    it('should fail with invalid data', async () => {
      const invalidDto = {
        nome: 'Test Client',
        email: 'invalid-email',
        documento: '123',
        tipoDocumento: 'INVALID',
      };

      await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /clientes', () => {
    it('should list clientes with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/clientes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should list clientes with search', async () => {
      const response = await request(app.getHttpServer())
        .get('/clientes?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should list clientes with pagination params', async () => {
      const response = await request(app.getHttpServer())
        .get('/clientes?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /clientes/:id', () => {
    it('should get a cliente by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/clientes/${testClienteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testClienteId);
      expect(response.body).toHaveProperty('nome');
    });

    it('should return 404 for nonexistent cliente', async () => {
      await request(app.getHttpServer())
        .get('/clientes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /clientes/:id', () => {
    it('should update a cliente', async () => {
      const updateDto = { nome: 'Updated Name' };

      const response = await request(app.getHttpServer())
        .patch(`/clientes/${testClienteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.nome).toBe('Updated Name');
    });

    it('should update multiple fields', async () => {
      const updateDto = {
        nome: 'New Name',
        email: 'newemail@example.com',
        telefone: '11988887777',
      };

      const response = await request(app.getHttpServer())
        .patch(`/clientes/${testClienteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.nome).toBe('New Name');
      expect(response.body.email).toBe('newemail@example.com');
    });
  });

  describe('DELETE /clientes/:id', () => {
    it('should delete a cliente', async () => {
      await request(app.getHttpServer())
        .delete(`/clientes/${testClienteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/clientes/${testClienteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for nonexistent cliente', async () => {
      await request(app.getHttpServer())
        .delete('/clientes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
