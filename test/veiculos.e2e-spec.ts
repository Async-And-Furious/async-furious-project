import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

function generateValidPlaca(prefix: string = 'ABC'): string {
  const suffix = Date.now().toString().slice(-4);
  return `${prefix.slice(0, 3)}${suffix[0]}${suffix[1]}${suffix[2]}${suffix[3]}`.slice(0, 7);
}

describe('VeiculosController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let authToken: string;

  let testClienteId: string;
  let testVeiculoId: string;
  const testUser = {
    email: 'veiculos-admin@example.com',
    password: 'admin123',
    name: 'Veiculos Test Admin',
  };

  const testCliente = {
    nome: 'Cliente para Veiculos',
    email: 'cliente-veiculos@example.com',
    telefone: '21999999999',
    documento: '98765432100',
    tipoDocumento: 'CPF',
  };

  const testVeiculoBase = {
    marca: 'Honda',
    modelo: 'Civic',
    ano: 2022,
    cor: 'Prata',
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

    await prismaService.cliente.deleteMany({ where: { documento: testCliente.documento } });
    await prismaService.user.deleteMany({ where: { email: testUser.email } });

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = await prismaService.user.create({
      data: { ...testUser, password: hashedPassword },
    });

    authToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    const clienteResponse = await request(app.getHttpServer())
      .post('/clientes')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testCliente)
      .expect(201);

    testClienteId = clienteResponse.body.id;
  });

  afterAll(async () => {
    if (testVeiculoId) {
      await prismaService.veiculo.deleteMany({ where: { id: testVeiculoId } });
    }
  if (testClienteId) {
    await prismaService.veiculo.deleteMany({ where: { id_cliente: testClienteId } });
    await prismaService.cliente.deleteMany({ where: { id: testClienteId } });
  }
    await prismaService.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  describe('POST /veiculos', () => {
    it('should create a new veiculo', async () => {
      const placa = generateValidPlaca('XYZ');
      const createVeiculoDto = {
        placa,
        ...testVeiculoBase,
        clienteId: testClienteId,
      };

      const response = await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createVeiculoDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.placa).toBe(placa);
      expect(response.body.marca).toBe(testVeiculoBase.marca);
      expect(response.body.clienteId).toBe(testClienteId);

      testVeiculoId = response.body.id;
    });

    it('should fail without auth token', async () => {
      const placa = generateValidPlaca('TST');
      const createVeiculoDto = {
        placa,
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2021,
        clienteId: testClienteId,
      };

      await request(app.getHttpServer())
        .post('/veiculos')
        .send(createVeiculoDto)
        .expect(401);
    });

    it('should fail with invalid data (missing required fields)', async () => {
      await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ marca: 'Toyota' })
        .expect(400);
    });

    it('should fail with invalid ano (before 1900)', async () => {
      const placa = generateValidPlaca('INV');
      const invalidDto = {
        placa,
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 1800,
        clienteId: testClienteId,
      };

      await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should fail with non-existent clienteId', async () => {
      const placa = generateValidPlaca('TST');
      const invalidDto = {
        placa,
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2021,
        clienteId: '00000000-0000-0000-0000-000000000000',
      };

      const response = await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should fail with duplicate placa', async () => {
      const placa = generateValidPlaca('DUP');
      const createDto = {
        placa,
        marca: 'Ford',
        modelo: 'Focus',
        ano: 2020,
        clienteId: testClienteId,
      };

      await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto);

      expect(response.status).toBeGreaterThanOrEqual(400);

      await prismaService.veiculo.deleteMany({ where: { placa } });
    });
  });

  describe('GET /veiculos', () => {
    it('should list veiculos with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should list veiculos with custom pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/veiculos?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should list veiculos with search by marca', async () => {
      const response = await request(app.getHttpServer())
        .get('/veiculos?search=Honda')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.some((v: any) => v.marca === 'Honda')).toBe(true);
    });

    it('should require auth token', async () => {
      await request(app.getHttpServer())
        .get('/veiculos')
        .expect(401);
    });
  });

  describe('GET /veiculos/:id', () => {
    it('should get a veiculo by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/veiculos/${testVeiculoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testVeiculoId);
      expect(response.body).toHaveProperty('placa');
      expect(response.body).toHaveProperty('marca');
    });

    it('should return 404 for nonexistent veiculo', async () => {
      await request(app.getHttpServer())
        .get('/veiculos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require auth token', async () => {
      await request(app.getHttpServer())
        .get(`/veiculos/${testVeiculoId}`)
        .expect(401);
    });
  });

  describe('PATCH /veiculos/:id', () => {
    it('should update a veiculo', async () => {
      const updateDto = { marca: 'Toyota' };

      const response = await request(app.getHttpServer())
        .patch(`/veiculos/${testVeiculoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.marca).toBe('Toyota');
    });

    it('should update multiple fields', async () => {
      const updateDto = {
        marca: 'Ford',
        modelo: 'Focus',
        ano: 2023,
        cor: 'Azul',
      };

      const response = await request(app.getHttpServer())
        .patch(`/veiculos/${testVeiculoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.marca).toBe('Ford');
      expect(response.body.modelo).toBe('Focus');
      expect(response.body.ano).toBe(2023);
    });

    it('should not allow updating clienteId', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/veiculos/${testVeiculoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clienteId: 'new-cliente-id' });

      expect(response.body.clienteId).toBe(testClienteId);
    });

    it('should return 404 for nonexistent veiculo', async () => {
      await request(app.getHttpServer())
        .patch('/veiculos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ marca: 'Ford' })
        .expect(404);
    });

    it('should require auth token', async () => {
      await request(app.getHttpServer())
        .patch(`/veiculos/${testVeiculoId}`)
        .send({ marca: 'Ford' })
        .expect(401);
    });

    it('should require admin role', async () => {
      const nonAdminUser = {
        email: 'nonadmin@example.com',
        password: 'user123',
        name: 'Non Admin User',
      };
      const hashedPassword = await bcrypt.hash(nonAdminUser.password, 10);
      const user = await prismaService.user.create({
        data: { ...nonAdminUser, password: hashedPassword, role: 'user' },
      });
      const nonAdminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

      await request(app.getHttpServer())
        .patch(`/veiculos/${testVeiculoId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ marca: 'Ford' })
        .expect(403);

      await prismaService.user.delete({ where: { email: nonAdminUser.email } });
    });
  });

  describe('DELETE /veiculos/:id', () => {
    let veiculoToDeleteId: string;
    let placaToDelete: string;

    beforeEach(async () => {
      placaToDelete = generateValidPlaca('DEL');
      const veiculo = await prismaService.veiculo.create({
        data: {
          placa: placaToDelete,
          marca: 'BMW',
          modelo: 'X1',
          ano: 2021,
          cor: 'Preto',
          id_cliente: testClienteId,
        },
      });
      veiculoToDeleteId = veiculo.id;
    });

    afterEach(async () => {
      await prismaService.veiculo.deleteMany({ where: { placa: placaToDelete } });
    });

    it('should delete a veiculo', async () => {
      await request(app.getHttpServer())
        .delete(`/veiculos/${veiculoToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/veiculos/${veiculoToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should cascade delete ordensServico when veiculo is deleted', async () => {
      const placaCascade = generateValidPlaca('CAS');
      const veiculo = await prismaService.veiculo.create({
        data: {
          placa: placaCascade,
          marca: 'Audi',
          modelo: 'A3',
          ano: 2022,
          id_cliente: testClienteId,
        },
      });

      await prismaService.ordemServico.create({
        data: {
          id_veiculo: veiculo.id,
          id_cliente: testClienteId,
          descricao: 'Servico de teste',
        },
      });

      await request(app.getHttpServer())
        .delete(`/veiculos/${veiculo.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const ordens = await prismaService.ordemServico.findMany({
        where: { id_veiculo: veiculo.id },
      });
      expect(ordens).toHaveLength(0);

      await prismaService.veiculo.deleteMany({ where: { placa: placaCascade } });
    });

    it('should return 404 for nonexistent veiculo', async () => {
      await request(app.getHttpServer())
        .delete('/veiculos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require auth token', async () => {
      await request(app.getHttpServer())
        .delete(`/veiculos/${veiculoToDeleteId}`)
        .expect(401);
    });
  });

  describe('Database Integration Tests', () => {
    it('should persist veiculo data correctly', async () => {
      const placa = generateValidPlaca('PRS');
      const createDto = {
        placa,
        marca: 'Chevrolet',
        modelo: 'Onix',
        ano: 2023,
        cor: 'Branco',
        clienteId: testClienteId,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      const veiculoId = createResponse.body.id;

      const dbVeiculo = await prismaService.veiculo.findUnique({
        where: { id: veiculoId },
      });

      expect(dbVeiculo).not.toBeNull();
      expect(dbVeiculo!.placa).toBe(placa);
      expect(dbVeiculo!.marca).toBe('Chevrolet');
      expect(dbVeiculo!.id_cliente).toBe(testClienteId);

      await prismaService.veiculo.delete({ where: { id: veiculoId } });
    });

    it('should link veiculo to cliente correctly', async () => {
      const anotherCliente = await prismaService.cliente.create({
        data: {
          nome: 'Another Cliente',
          email: `another${Date.now()}@example.com`,
          documento: `DOC${Date.now()}`,
          tipo_documento: 'CPF',
        },
      });

      const placa = generateValidPlaca('LNK');
      const createDto = {
        placa,
        marca: 'Fiat',
        modelo: 'Uno',
        ano: 2020,
        clienteId: anotherCliente.id,
      };

      const response = await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.clienteId).toBe(anotherCliente.id);

      const clienteWithVeiculos = await prismaService.cliente.findUnique({
        where: { id: anotherCliente.id },
        include: { veiculos: true },
      });

      expect(clienteWithVeiculos!.veiculos.some((v) => v.id === response.body.id)).toBe(true);

      await prismaService.veiculo.delete({ where: { id: response.body.id } });
      await prismaService.cliente.delete({ where: { id: anotherCliente.id } });
    });

    it('should update veiculo timestamps on modification', async () => {
      const placa = generateValidPlaca('TMP');
      const createDto = {
        placa,
        marca: 'Renault',
        modelo: 'Kwid',
        ano: 2022,
        clienteId: testClienteId,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/veiculos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      const veiculoId = createResponse.body.id;

      const originalVeiculo = await prismaService.veiculo.findUnique({
        where: { id: veiculoId },
      });

      const originalUpdatedAt = originalVeiculo!.updated_at;

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app.getHttpServer())
        .patch(`/veiculos/${veiculoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ marca: 'Renault Updated' })
        .expect(200);

      const updatedVeiculo = await prismaService.veiculo.findUnique({
        where: { id: veiculoId },
      });

      expect(updatedVeiculo!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());

      await prismaService.veiculo.delete({ where: { id: veiculoId } });
    });
  });
});
