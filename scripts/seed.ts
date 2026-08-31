import dotenv from 'dotenv';
import { Prisma, PrismaClient, TaxIdType, SOStatus, EstimateStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

dotenv.config();

if (process.env.DEPLOY_ENV === 'prod' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  console.error('Production seed is disabled unless ALLOW_PRODUCTION_SEED=true');
  process.exit(1);
}

const prisma = new PrismaClient();
type SeedClient = Prisma.TransactionClient;

function stableSeedId(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const recepcionistaPassword = process.env.SEED_RECEPCIONISTA_PASSWORD;
const mecanicoPassword = process.env.SEED_MECANICO_PASSWORD;

if (!email || !password || !recepcionistaPassword || !mecanicoPassword) {
  console.error(
    '❌ SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_RECEPCIONISTA_PASSWORD and SEED_MECANICO_PASSWORD must be set'
  );
  console.error('   Add these to your .env file');
  process.exit(1);
}

const CLIENTES = [
  {
    nome: 'Carlos Eduardo Mendes',
    email: 'carlos.mendes@email.com',
    telefone: '(11) 98765-4321',
    documento: '12345678909',
    tipoDocumento: TaxIdType.CPF,
  },
  {
    nome: 'Ana Paula Ferreira',
    email: 'ana.ferreira@email.com',
    telefone: '(21) 97654-3210',
    documento: '23456789092',
    tipoDocumento: TaxIdType.CPF,
  },
  {
    nome: 'Roberto Silva Santos',
    email: 'roberto.santos@email.com',
    telefone: '(31) 96543-2109',
    documento: '34567890175',
    tipoDocumento: TaxIdType.CPF,
  },
  {
    nome: 'Mariana Costa Lima',
    email: 'mariana.lima@email.com',
    telefone: '(41) 95432-1098',
    documento: '45678901249',
    tipoDocumento: TaxIdType.CPF,
  },
  {
    nome: 'João Luiz Oliveira',
    email: 'joao.oliveira@email.com',
    telefone: '(51) 94321-0987',
    documento: '56789012303',
    tipoDocumento: TaxIdType.CPF,
  },
  {
    nome: 'Fernanda Rodrigues',
    email: 'fernanda.rodrigues@email.com',
    telefone: '(61) 93210-9876',
    documento: '67890123469',
    tipoDocumento: TaxIdType.CPF,
  },
  {
    nome: 'Mecânica Rápida Ltda',
    email: 'contato@mecanicaRapida.com',
    telefone: '(11) 3456-7890',
    documento: '11222333000181',
    tipoDocumento: TaxIdType.CNPJ,
  },
  {
    nome: 'Transportadora ABC S.A.',
    email: 'frota@transportadoraABC.com',
    telefone: '(21) 2345-6789',
    documento: '22333444000181',
    tipoDocumento: TaxIdType.CNPJ,
  },
  {
    nome: 'Locadora VelozCar',
    email: 'manutencao@velozcar.com',
    telefone: '(31) 3456-7891',
    documento: '33444555000181',
    tipoDocumento: TaxIdType.CNPJ,
  },
  {
    nome: 'Escola Direção Segura',
    email: 'admin@direcaoSegura.com',
    telefone: '(41) 4567-8901',
    documento: '44555666000181',
    tipoDocumento: TaxIdType.CNPJ,
  },
  {
    nome: 'Lucas Pereira Alves',
    email: 'lucas.alves@email.com',
    telefone: '(71) 92109-8765',
    documento: '78901234505',
    tipoDocumento: TaxIdType.CPF,
  },
  {
    nome: 'Beatriz Nascimento',
    email: 'beatriz.nascimento@email.com',
    telefone: '(81) 91098-7654',
    documento: '89012345642',
    tipoDocumento: TaxIdType.CPF,
  },
];

const VEICULOS_TEMPLATE = [
  { placa: 'ABC1D23', marca: 'Toyota', modelo: 'Corolla', ano: 2022, cor: 'Prata' },
  { placa: 'DEF2E34', marca: 'Honda', modelo: 'Civic', ano: 2021, cor: 'Preto' },
  { placa: 'GHI3F45', marca: 'Volkswagen', modelo: 'Golf', ano: 2023, cor: 'Branco' },
  { placa: 'JKL4G56', marca: 'Ford', modelo: 'Ka', ano: 2020, cor: 'Vermelho' },
  { placa: 'MNO5H67', marca: 'Chevrolet', modelo: 'Onix', ano: 2022, cor: 'Cinza' },
  { placa: 'PQR6I78', marca: 'Hyundai', modelo: 'HB20', ano: 2021, cor: 'Azul' },
  { placa: 'STU7J89', marca: 'Fiat', modelo: 'Argo', ano: 2023, cor: 'Prata' },
  { placa: 'VWX8K90', marca: 'Renault', modelo: 'Kwid', ano: 2022, cor: 'Laranja' },
  { placa: 'YZA9L01', marca: 'Jeep', modelo: 'Renegade', ano: 2021, cor: 'Verde' },
  { placa: 'BCD0M12', marca: 'Toyota', modelo: 'Hilux', ano: 2023, cor: 'Branco' },
  { placa: 'EFG1N23', marca: 'Volkswagen', modelo: 'Gol', ano: 2019, cor: 'Preto' },
  { placa: 'HIJ2O34', marca: 'Honda', modelo: 'Fit', ano: 2020, cor: 'Prata' },
  { placa: 'KLM3P45', marca: 'Ford', modelo: 'EcoSport', ano: 2022, cor: 'Branco' },
  { placa: 'NOP4Q56', marca: 'Chevrolet', modelo: 'Tracker', ano: 2023, cor: 'Azul' },
  { placa: 'QRS5R67', marca: 'Mitsubishi', modelo: 'Outlander', ano: 2021, cor: 'Prata' },
  { placa: 'TUV6S78', marca: 'Nissan', modelo: 'Kicks', ano: 2022, cor: 'Vermelho' },
  { placa: 'WXY7T89', marca: 'Fiat', modelo: 'Toro', ano: 2023, cor: 'Cinza' },
  { placa: 'ZAB8U90', marca: 'Hyundai', modelo: 'Creta', ano: 2022, cor: 'Branco' },
  { placa: 'CDE9V01', marca: 'BMW', modelo: 'X1', ano: 2022, cor: 'Preto' },
  { placa: 'FGH0W12', marca: 'Mercedes-Benz', modelo: 'Classe A', ano: 2021, cor: 'Prata' },
];

const SERVICOS = [
  {
    nome: 'Troca de Óleo e Filtro',
    descricao: 'Substituição do óleo do motor e filtro de óleo',
    preco: 120.0,
  },
  {
    nome: 'Alinhamento e Balanceamento',
    descricao: 'Alinhamento computadorizado da direção e balanceamento das rodas',
    preco: 180.0,
  },
  {
    nome: 'Revisão Completa 30.000 km',
    descricao: 'Revisão completa incluindo filtros, fluidos, velas e correia',
    preco: 850.0,
  },
  {
    nome: 'Troca de Pastilhas de Freio',
    descricao: 'Substituição das pastilhas dianteiras ou traseiras',
    preco: 280.0,
  },
  {
    nome: 'Troca de Correia Dentada',
    descricao: 'Substituição da correia dentada e tensor',
    preco: 450.0,
  },
  {
    nome: 'Diagnóstico Eletrônico',
    descricao: 'Leitura de códigos de falha e diagnóstico por scanner automotivo',
    preco: 150.0,
  },
  {
    nome: 'Troca de Amortecedores',
    descricao: 'Substituição do par de amortecedores dianteiros ou traseiros',
    preco: 620.0,
  },
  {
    nome: 'Higienização do Ar Condicionado',
    descricao: 'Limpeza e higienização do sistema de ar condicionado',
    preco: 200.0,
  },
  {
    nome: 'Polimento e Cristalização',
    descricao: 'Polimento da pintura e cristalização protetora',
    preco: 380.0,
  },
  {
    nome: 'Troca de Bateria',
    descricao: 'Substituição da bateria do veículo com teste de carga',
    preco: 320.0,
  },
  {
    nome: 'Revisão do Sistema de Freios',
    descricao: 'Inspeção e ajuste completo do sistema de frenagem',
    preco: 220.0,
  },
  {
    nome: 'Troca de Velas de Ignição',
    descricao: 'Substituição do jogo de velas de ignição',
    preco: 160.0,
  },
  {
    nome: 'Limpeza de Bicos Injetores',
    descricao: 'Limpeza ultrassônica dos injetores de combustível',
    preco: 340.0,
  },
  {
    nome: 'Troca de Fluido de Transmissão',
    descricao: 'Substituição do óleo da caixa de câmbio',
    preco: 280.0,
  },
  {
    nome: 'Geometria da Suspensão',
    descricao: 'Ajuste da geometria completa da suspensão',
    preco: 250.0,
  },
  {
    nome: 'Revisão Elétrica',
    descricao: 'Inspeção e reparo do sistema elétrico do veículo',
    preco: 190.0,
  },
  {
    nome: 'Troca de Filtro de Combustível',
    descricao: 'Substituição do filtro de combustível',
    preco: 95.0,
  },
  {
    nome: 'Troca de Fluido de Arrefecimento',
    descricao: 'Descarga e recarga do fluido do radiador',
    preco: 140.0,
  },
  {
    nome: 'Reparo do Sistema de Escapamento',
    descricao: 'Inspeção e reparo de vazamentos no escapamento',
    preco: 310.0,
  },
  {
    nome: 'Calibração de Faróis',
    descricao: 'Regulagem e alinhamento dos faróis dianteiros',
    preco: 80.0,
  },
];

const PECAS_INSUMOS = [
  {
    nome: 'Óleo Motor 5W30 Sintético 1L',
    codigo: 'OLM-5W30-1L',
    descricao: 'Óleo lubrificante sintético para motor',
    preco: 45.9,
    quantidade_estoque: 120,
    quantidade_minima: 20,
  },
  {
    nome: 'Filtro de Óleo Universal',
    codigo: 'FLT-OLH-001',
    descricao: 'Filtro de óleo para motores 1.0 a 2.0',
    preco: 28.5,
    quantidade_estoque: 80,
    quantidade_minima: 15,
  },
  {
    nome: 'Pastilha de Freio Dianteira (par)',
    codigo: 'PFD-001-PAR',
    descricao: 'Pastilha de freio dianteira cerâmica de alta performance',
    preco: 89.9,
    quantidade_estoque: 60,
    quantidade_minima: 10,
  },
  {
    nome: 'Pastilha de Freio Traseira (par)',
    codigo: 'PFT-001-PAR',
    descricao: 'Pastilha de freio traseira para veículos compactos',
    preco: 79.9,
    quantidade_estoque: 55,
    quantidade_minima: 10,
  },
  {
    nome: 'Vela de Ignição NGK (unidade)',
    codigo: 'VIG-NGK-001',
    descricao: 'Vela de ignição de platina NGK',
    preco: 32.0,
    quantidade_estoque: 200,
    quantidade_minima: 40,
  },
  {
    nome: 'Correia Dentada Kit Completo',
    codigo: 'CDK-KIT-001',
    descricao: 'Kit correia dentada com tensor e polia',
    preco: 185.0,
    quantidade_estoque: 25,
    quantidade_minima: 5,
  },
  {
    nome: 'Fluido de Freio DOT 4 500ml',
    codigo: 'FFR-DOT4-500',
    descricao: 'Fluido de freio DOT 4 para sistemas hidráulicos',
    preco: 22.5,
    quantidade_estoque: 90,
    quantidade_minima: 20,
  },
  {
    nome: 'Fluido de Arrefecimento 1L',
    codigo: 'FAR-001-1L',
    descricao: 'Aditivo para radiador concentrado',
    preco: 18.9,
    quantidade_estoque: 75,
    quantidade_minima: 15,
  },
  {
    nome: 'Amortecedor Dianteiro Direito',
    codigo: 'AMD-DIR-001',
    descricao: 'Amortecedor dianteiro direito para compactos',
    preco: 195.0,
    quantidade_estoque: 20,
    quantidade_minima: 4,
  },
  {
    nome: 'Amortecedor Dianteiro Esquerdo',
    codigo: 'AMD-ESQ-001',
    descricao: 'Amortecedor dianteiro esquerdo para compactos',
    preco: 195.0,
    quantidade_estoque: 20,
    quantidade_minima: 4,
  },
  {
    nome: 'Bateria 60Ah 500A',
    codigo: 'BAT-60AH-500',
    descricao: 'Bateria automotiva selada 60Ah',
    preco: 280.0,
    quantidade_estoque: 15,
    quantidade_minima: 3,
  },
  {
    nome: 'Filtro de Ar do Motor',
    codigo: 'FAR-MOT-001',
    descricao: 'Filtro de ar de papel para motor',
    preco: 35.0,
    quantidade_estoque: 70,
    quantidade_minima: 15,
  },
  {
    nome: 'Filtro de Combustível',
    codigo: 'FCB-001-UNI',
    descricao: 'Filtro de combustível universal para injetados',
    preco: 42.0,
    quantidade_estoque: 50,
    quantidade_minima: 10,
  },
  {
    nome: 'Filtro de Ar Condicionado (cabine)',
    codigo: 'FAC-CAB-001',
    descricao: 'Filtro de ar para cabine do veículo',
    preco: 55.0,
    quantidade_estoque: 45,
    quantidade_minima: 8,
  },
  {
    nome: 'Óleo Câmbio Automático ATF',
    codigo: 'OCB-ATF-1L',
    descricao: 'Fluido para câmbio automático ATF Dexron III',
    preco: 38.0,
    quantidade_estoque: 40,
    quantidade_minima: 8,
  },
  {
    nome: 'Disco de Freio Dianteiro (par)',
    codigo: 'DFD-001-PAR',
    descricao: 'Par de discos de freio dianteiros ventilados',
    preco: 245.0,
    quantidade_estoque: 18,
    quantidade_minima: 4,
  },
  {
    nome: 'Vela de Ignição Iridium (unidade)',
    codigo: 'VIG-IRI-001',
    descricao: 'Vela de ignição de iridium de longa duração',
    preco: 58.0,
    quantidade_estoque: 100,
    quantidade_minima: 20,
  },
  {
    nome: 'Produto Limpeza Injetores 300ml',
    codigo: 'PLI-300ML-001',
    descricao: 'Produto para limpeza de injetores e sistema de combustível',
    preco: 49.9,
    quantidade_estoque: 60,
    quantidade_minima: 12,
  },
  {
    nome: 'Fluido de Direção Hidráulica 500ml',
    codigo: 'FDH-500ML-001',
    descricao: 'Fluido para sistema de direção hidráulica',
    preco: 25.0,
    quantidade_estoque: 35,
    quantidade_minima: 7,
  },
  {
    nome: 'Rolamento de Roda Dianteiro',
    codigo: 'RRD-001-UNI',
    descricao: 'Rolamento de roda dianteiro selado',
    preco: 120.0,
    quantidade_estoque: 30,
    quantidade_minima: 6,
  },
  {
    nome: 'Palheta do Limpador Dianteiro (par)',
    codigo: 'PLD-001-PAR',
    descricao: 'Par de palhetas do limpador de parabrisa dianteiro',
    preco: 48.0,
    quantidade_estoque: 65,
    quantidade_minima: 12,
  },
  {
    nome: 'Lâmpada Farol H4 (par)',
    codigo: 'LFH4-PAR-001',
    descricao: 'Par de lâmpadas halógenas H4 para faróis',
    preco: 35.0,
    quantidade_estoque: 80,
    quantidade_minima: 16,
  },
  {
    nome: 'Abraçadeira Metálica 50mm',
    codigo: 'ABR-MET-50',
    descricao: 'Abraçadeira em aço inox para mangueiras',
    preco: 4.5,
    quantidade_estoque: 300,
    quantidade_minima: 50,
  },
  {
    nome: 'Massa de Rolamento EP2 500g',
    codigo: 'MRL-EP2-500',
    descricao: 'Graxa multiuso para rolamentos',
    preco: 32.0,
    quantidade_estoque: 40,
    quantidade_minima: 8,
  },
  {
    nome: 'Spray Limpa Contato 300ml',
    codigo: 'SLC-300ML-001',
    descricao: 'Spray para limpeza de contatos elétricos',
    preco: 27.9,
    quantidade_estoque: 50,
    quantidade_minima: 10,
  },
];

async function seedAdmin(db: SeedClient): Promise<void> {
  const normalizedEmail = email?.toLowerCase()?.trim() ?? '';
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (!existing) {
    const hashedPassword = await bcrypt.hash(password ?? '', 10);
    try {
      await db.user.create({
        data: {
          id: stableSeedId(`user:${normalizedEmail}`),
          email: normalizedEmail,
          password: hashedPassword,
          name: 'Admin User',
          role: 'ADMIN',
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      await db.user.findUniqueOrThrow({ where: { email: normalizedEmail } });
    }
  }
  console.log(`  ✅ Admin criado/atualizado: ${email}`);
}

async function seedRecepcionista(db: SeedClient): Promise<void> {
  const recepEmail = 'recepcionista@oficina.com';
  const existing = await db.user.findUnique({ where: { email: recepEmail } });
  if (!existing) {
    const hashedPassword = await bcrypt.hash(recepcionistaPassword, 10);
    try {
      await db.user.create({
        data: {
          id: stableSeedId(`user:${recepEmail}`),
          email: recepEmail,
          password: hashedPassword,
          name: 'Recepcionista Padrão',
          role: 'RECEPCIONISTA',
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      await db.user.findUniqueOrThrow({ where: { email: recepEmail } });
    }
  }
  console.log(`  ✅ Recepcionista criada: ${recepEmail}`);
}

async function seedMecanico(db: SeedClient): Promise<void> {
  const mecEmail = 'mecanico@oficina.com';
  const existing = await db.user.findUnique({ where: { email: mecEmail } });
  if (!existing) {
    const hashedPassword = await bcrypt.hash(mecanicoPassword, 10);
    try {
      await db.user.create({
        data: {
          id: stableSeedId(`user:${mecEmail}`),
          email: mecEmail,
          password: hashedPassword,
          name: 'Mecânico Padrão',
          role: 'MECANICO',
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      await db.user.findUniqueOrThrow({ where: { email: mecEmail } });
    }
  }
  console.log(`  ✅ Mecânico criado: ${mecEmail}`);
}

async function seedClientes(db: SeedClient): Promise<string[]> {
  const ids: string[] = [];
  let criados = 0;
  let pulados = 0;
  for (const c of CLIENTES) {
    const existing = await db.cliente.findUnique({ where: { documento: c.documento } });
    const cliente = await db.cliente.upsert({
      where: { documento: c.documento },
      update: {},
      create: {
        id: stableSeedId(`cliente:${c.documento}`),
        nome: c.nome,
        email: c.email,
        telefone: c.telefone,
        documento: c.documento,
        tipo_documento: c.tipoDocumento,
      },
    });
    ids.push(cliente.id);
    if (existing) pulados++;
    else criados++;
  }
  console.log(`  ✅ Clientes: ${criados} criados, ${pulados} já existiam`);
  return ids;
}

async function seedVeiculos(db: SeedClient, clienteIds: string[]): Promise<void> {
  let criados = 0;
  let pulados = 0;
  for (let i = 0; i < VEICULOS_TEMPLATE.length; i++) {
    const v = VEICULOS_TEMPLATE[i];
    const clienteId = clienteIds[i % clienteIds.length];
    const existing = await db.veiculo.findUnique({ where: { placa: v.placa } });
    await db.veiculo.upsert({
      where: { placa: v.placa },
      update: {},
      create: {
        id: stableSeedId(`veiculo:${v.placa}`),
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        ano: v.ano,
        cor: v.cor,
        id_cliente: clienteId,
      },
    });
    if (existing) pulados++;
    else criados++;
  }
  console.log(`  ✅ Veículos: ${criados} criados, ${pulados} já existiam`);
}

async function seedServicos(db: SeedClient): Promise<void> {
  let criados = 0;
  let pulados = 0;
  for (const s of SERVICOS) {
    const created = await seedServico(db, s);
    if (created) criados++;
    else pulados++;
  }
  console.log(`  ✅ Serviços: ${criados} criados, ${pulados} já existiam`);
}

async function seedServico(db: SeedClient, service: (typeof SERVICOS)[number]): Promise<boolean> {
  const id = stableSeedId(`servico:${service.nome}`);
  let lastConflict: Prisma.PrismaClientKnownRequestError | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await db.servico.findFirst({ where: { nome: service.nome } })) return false;
    try {
      await db.servico.create({
        data: { id, nome: service.nome, descricao: service.descricao, preco: service.preco },
      });
      return true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      lastConflict = error;
      const [byName, byId] = await Promise.all([
        db.servico.findFirst({ where: { nome: service.nome } }),
        db.servico.findUnique({ where: { id } }),
      ]);
      if (byName || byId) return false;
    }
  }
  const [existing, seeded] = await Promise.all([
    db.servico.findFirst({ where: { nome: service.nome } }),
    db.servico.findUnique({ where: { id } }),
  ]);
  if (!existing && !seeded && lastConflict) throw lastConflict;
  return false;
}

async function seedPecasInsumos(db: SeedClient): Promise<void> {
  let criados = 0;
  let pulados = 0;
  for (const p of PECAS_INSUMOS) {
    const existing = await db.peca.findUnique({ where: { codigo: p.codigo } });
    await db.peca.upsert({
      where: { codigo: p.codigo },
      update: {},
      create: {
        id: stableSeedId(`peca:${p.codigo}`),
        nome: p.nome,
        codigo: p.codigo,
        descricao: p.descricao,
        preco: p.preco,
        quantidade_estoque: p.quantidade_estoque,
        quantidade_minima: p.quantidade_minima,
      },
    });
    if (existing) pulados++;
    else criados++;
  }
  console.log(`  ✅ Peças/Insumos: ${criados} criados, ${pulados} já existiam`);
}

async function seedOrdensServico(db: SeedClient, clienteIds: string[]): Promise<void> {
  const seededVehicleIds = VEICULOS_TEMPLATE.map(({ placa }) => stableSeedId(`veiculo:${placa}`));
  const veiculos = await db.veiculo.findMany({
    where: { id: { in: seededVehicleIds } },
    orderBy: { id: 'asc' },
    take: 10,
  });
  if (veiculos.length === 0) return;

  const OS_TEMPLATES = [
    {
      descricao: 'Troca de óleo e revisão completa do motor',
      status: SOStatus.RECEIVED,
      orcamento: null,
    },
    {
      descricao: 'Barulho na suspensão dianteira',
      status: SOStatus.UNDER_DIAGNOSIS,
      orcamento: null,
    },
    {
      descricao: 'Falha no sistema de freios — pastilhas desgastadas',
      status: SOStatus.AWAITING_APPROVAL,
      orcamento: {
        valor_total_servicos: 280.0,
        valor_total_pecas: 89.9,
        status: EstimateStatus.PENDING,
      },
    },
    {
      descricao: 'Revisão dos 30.000 km',
      status: SOStatus.IN_PROGRESS,
      orcamento: {
        valor_total_servicos: 850.0,
        valor_total_pecas: 230.0,
        status: EstimateStatus.APPROVED,
      },
    },
    {
      descricao: 'Troca de correia dentada e tensor',
      status: SOStatus.FINISHED,
      orcamento: {
        valor_total_servicos: 450.0,
        valor_total_pecas: 185.0,
        status: EstimateStatus.APPROVED,
      },
    },
    {
      descricao: 'Higienização do ar condicionado',
      status: SOStatus.DELIVERED,
      orcamento: {
        valor_total_servicos: 200.0,
        valor_total_pecas: 0.0,
        status: EstimateStatus.APPROVED,
      },
    },
    {
      descricao: 'Diagnóstico eletrônico — luz de injeção acesa',
      status: SOStatus.AWAITING_APPROVAL,
      orcamento: {
        valor_total_servicos: 150.0,
        valor_total_pecas: 49.9,
        status: EstimateStatus.REJECTED,
      },
    },
    {
      descricao: 'Troca de bateria e verificação elétrica',
      status: SOStatus.DELIVERED,
      orcamento: {
        valor_total_servicos: 190.0,
        valor_total_pecas: 280.0,
        status: EstimateStatus.APPROVED,
      },
    },
    {
      descricao: 'Alinhamento, balanceamento e geometria',
      status: SOStatus.IN_PROGRESS,
      orcamento: {
        valor_total_servicos: 430.0,
        valor_total_pecas: 0.0,
        status: EstimateStatus.APPROVED,
      },
    },
    {
      descricao: 'Reparo no escapamento com vazamento',
      status: SOStatus.DELIVERED,
      orcamento: {
        valor_total_servicos: 310.0,
        valor_total_pecas: 0.0,
        status: EstimateStatus.REJECTED,
      },
    },
  ];

  let criadas = 0;
  let puladas = 0;

  for (let i = 0; i < OS_TEMPLATES.length; i++) {
    const template = OS_TEMPLATES[i];
    const veiculo = veiculos[i % veiculos.length];
    const clienteId = clienteIds[i % clienteIds.length];

    const existing = await db.ordemServico.findFirst({
      where: { id_veiculo: veiculo.id, descricao: template.descricao },
    });

    let os = existing;
    if (!os) {
      const id = stableSeedId(`${veiculo.id}:${template.descricao}`);
      try {
        os = await db.ordemServico.create({
          data: {
            id,
            id_veiculo: veiculo.id,
            id_cliente: clienteId,
            status: template.status,
            descricao: template.descricao,
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
          throw error;
        os = await db.ordemServico.findFirst({
          where: { id_veiculo: veiculo.id, descricao: template.descricao },
        });
        if (!os) throw error;
      }
    }

    if (existing) {
      puladas++;
    } else {
      criadas++;
    }

    if (template.orcamento) {
      const { valor_total_servicos, valor_total_pecas, status } = template.orcamento;
      await db.orcamento.upsert({
        where: { id_ordem_servico: os.id },
        update: {
          valor_total_servicos,
          valor_total_pecas,
          valor_total_geral: valor_total_servicos + valor_total_pecas,
          status,
        },
        create: {
          id: stableSeedId(`orcamento:${os.id}`),
          id_ordem_servico: os.id,
          valor_total_servicos,
          valor_total_pecas,
          valor_total_geral: valor_total_servicos + valor_total_pecas,
          status,
        },
      });
    }
  }

  console.log(`  ✅ Ordens de Serviço: ${criadas} criadas, ${puladas} já existiam`);
}

async function seed(): Promise<void> {
  console.log('🌱 Seedando banco de dados...\n');

  await prisma.$transaction(
    async (db) => {
      await seedAdmin(db);
      await seedRecepcionista(db);
      await seedMecanico(db);
      const clienteIds = await seedClientes(db);
      await seedVeiculos(db, clienteIds);
      await seedServicos(db);
      await seedPecasInsumos(db);
      await seedOrdensServico(db, clienteIds);
    },
    // Keep the complete seed atomic while allowing its many writes to finish.
    { maxWait: 10_000, timeout: 120_000 }
  );

  console.log('\n🎉 Seed concluído com sucesso!');
}

seed()
  .catch(() => {
    console.error('❌ Seed falhou');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
