import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { cpf } from 'cpf-cnpj-validator';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import {
  PUBLICADOR_INTEGRACAO,
  type EventoIntegracao,
  type IPublicadorIntegracao,
} from '../../../src/shared/domain/interfaces/publicador-integracao.interface';
import { ProcessadorMensagensSaga } from '../../../src/modules/ordem-servico/infrastructure/messaging/processador-mensagens-saga';
import {
  despachantesBilling,
  despachantesExecucao,
} from '../../../src/modules/ordem-servico/infrastructure/messaging/despachantes-saga';
import { AtualizarStatusEmDiagnosticoHandler } from '../../../src/modules/ordem-servico/application/event-handlers/atualizar-status-em-diagnostico.handler';
import { AtualizarStatusExecucaoIniciadaHandler } from '../../../src/modules/ordem-servico/application/event-handlers/atualizar-status-execucao-iniciada.handler';
import { AtualizarStatusFinalizadaHandler } from '../../../src/modules/ordem-servico/application/event-handlers/atualizar-status-finalizada.handler';
import { AtualizarStatusAguardandoAprovacaoHandler } from '../../../src/modules/ordem-servico/application/event-handlers/atualizar-status-aguardando-aprovacao.handler';
import { VerificarNecessidadePecasHandler } from '../../../src/modules/ordem-servico/application/event-handlers/verificar-necessidade-pecas.handler';
import { AtualizarStatusEncerradaSemExecucaoHandler } from '../../../src/modules/ordem-servico/application/event-handlers/atualizar-status-encerrada-sem-execucao.handler';
import { RegistrarPagamentoConfirmadoHandler } from '../../../src/modules/ordem-servico/application/event-handlers/registrar-pagamento-confirmado.handler';
import { OrdemServicoRepository } from '../../../src/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository';
import type { OrdemDeServico } from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import {
  BILLING_TOPIC,
  EXECUCAO_TOPIC,
} from '../../../src/shared/infrastructure/mensageria/kafka.config';
import { cleanupTestUser, createTestUser } from '../../support/fixtures';

/** Origem simulada dos eventos que entram no consumidor da saga. */
export type ServicoSimulado = 'execucao' | 'billing';

interface MensagemEnviada {
  topic: string;
  key: string | null;
  envelope: unknown;
}

/**
 * OS Service de pé para o cenário BDD: app Nest real (módulos, handlers e repositórios) sobre o
 * PostgreSQL de teste. Execução e Billing não sobem: os eventos deles
 * entram pelo mesmo `ProcessadorMensagensSaga` que o consumidor Kafka usa, com os mesmos
 * despachantes do módulo.
 */
export class AmbienteSaga {
  private app!: INestApplication;
  private readonly documentoCliente = cpf.generate();
  private readonly emailCliente = `bdd-cliente-${randomUUID()}@example.com`;
  private readonly emailRecepcionista = `bdd-recepcionista-${randomUUID()}@example.com`;
  private readonly emailMecanico = `bdd-mecanico-${randomUUID()}@example.com`;
  private readonly osCriadas: string[] = [];
  private readonly pecasCriadas: string[] = [];
  private readonly publicadosNoOs: string[] = [];
  private readonly enviadosPeloConsumidor: MensagemEnviada[] = [];
  private processador: ProcessadorMensagensSaga | null = null;
  private tokenRecepcionista = '';
  private tokenMecanico = '';

  static async subir(): Promise<AmbienteSaga> {
    const ambiente = new AmbienteSaga();
    const publicador: IPublicadorIntegracao = {
      publicar: (evento: EventoIntegracao) => ambiente.registrarPublicacao(evento),
    };

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PUBLICADOR_INTEGRACAO)
      .useValue(publicador)
      .compile();

    ambiente.app = moduleFixture.createNestApplication();
    // Mesmo prefixo e validação de src/main.ts: as rotas da suíte são as reais.
    ambiente.app.setGlobalPrefix('api/v1');
    ambiente.app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    await ambiente.app.init();

    const jwt = moduleFixture.get(JwtService);
    const prisma = moduleFixture.get(PrismaService);
    const recepcionista = await createTestUser(prisma, jwt, {
      email: ambiente.emailRecepcionista,
      password: 'admin123',
      name: 'Recepcionista BDD',
      role: 'RECEPCIONISTA',
    });
    const mecanico = await createTestUser(prisma, jwt, {
      email: ambiente.emailMecanico,
      password: 'admin123',
      name: 'Mecanico BDD',
      role: 'MECANICO',
    });
    ambiente.tokenRecepcionista = recepcionista.token;
    ambiente.tokenMecanico = mecanico.token;
    return ambiente;
  }

  /** Monta o consumidor da saga com os handlers reais, como `OrdemServicoModule` faz para o Kafka. */
  conectarConsumidorSimulado(): void {
    this.processador = new ProcessadorMensagensSaga({
      despachantes: {
        ...despachantesExecucao({
          emDiagnostico: this.app.get(AtualizarStatusEmDiagnosticoHandler),
          execucaoIniciada: this.app.get(AtualizarStatusExecucaoIniciadaHandler),
          finalizada: this.app.get(AtualizarStatusFinalizadaHandler),
        }),
        ...despachantesBilling({
          aguardandoAprovacao: this.app.get(AtualizarStatusAguardandoAprovacaoHandler),
          verificarNecessidadePecas: this.app.get(VerificarNecessidadePecasHandler),
          encerradaSemExecucao: this.app.get(AtualizarStatusEncerradaSemExecucaoHandler),
          pagamentoConfirmado: this.app.get(RegistrarPagamentoConfirmadoHandler),
        }),
      },
      publicador: { publicar: (evento) => this.registrarPublicacao(evento) },
      enviar: (topic, key, envelope) => {
        this.enviadosPeloConsumidor.push({ topic, key, envelope });
        return Promise.resolve();
      },
    });
  }

  /**
   * Entrega um evento simulado no tópico de origem. Se o consumidor mandar a mensagem para
   * retry ou DLT, a entrega falha: sem Kafka real nada a reentregaria, e o cenário esconderia o erro.
   */
  async entregar(
    servico: ServicoSimulado,
    ordemServicoId: string,
    eventType: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.processador) throw new Error('consumidor simulado não foi conectado');
    const topic = servico === 'execucao' ? EXECUCAO_TOPIC : BILLING_TOPIC;
    const envelope = {
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: ordemServicoId,
      producer: servico === 'execucao' ? 'execucao-producao-service' : 'billing-service',
      data: { ordemServicoId, ...data },
    };
    const enviadosAntes = this.enviadosPeloConsumidor.length;
    await this.processador.processar(topic, ordemServicoId, Buffer.from(JSON.stringify(envelope)));
    const novos = this.enviadosPeloConsumidor.slice(enviadosAntes);
    if (novos.length > 0) {
      throw new Error(
        `${eventType} da OS ${ordemServicoId} não foi processado e saiu para ${novos[0].topic}: ${JSON.stringify(novos[0].envelope)}`
      );
    }
  }

  async criarPecaEmEstoque(quantidade: number): Promise<string> {
    const peca = await this.prisma().peca.create({
      data: {
        nome: 'Filtro de óleo (BDD)',
        codigo: `BDD-${randomUUID()}`,
        preco: 60,
        quantidade_estoque: quantidade,
      },
    });
    this.pecasCriadas.push(peca.id);
    return peca.id;
  }

  async estoqueDaPeca(idPeca: string): Promise<number> {
    const peca = await this.prisma().peca.findUniqueOrThrow({ where: { id: idPeca } });
    return peca.quantidade_estoque;
  }

  async abrirOs(idPeca: string): Promise<string> {
    const resposta = await request(this.servidor())
      .post('/api/v1/ordens-servico')
      .set('Authorization', `Bearer ${this.tokenRecepcionista}`)
      .send({
        cliente: {
          nome: 'Cliente BDD',
          email: this.emailCliente,
          telefone: '11999999999',
          documento: this.documentoCliente,
          tipoDocumento: 'CPF',
        },
        veiculo: {
          placa: `BDD${randomInt(1000, 10000)}`,
          marca: 'Honda',
          modelo: 'Fit',
          ano: 2021,
          cor: 'Prata',
        },
        servicos: [],
        pecas: [{ id_peca: idPeca, quantidade: 1 }],
        descricao: 'Revisão com troca de óleo (BDD)',
      });
    this.esperarStatus(resposta.status, 201, 'abrir a OS');
    const { id } = resposta.body as { id: string };
    this.osCriadas.push(id);
    return id;
  }

  async statusDaOs(ordemServicoId: string): Promise<string> {
    const resposta = await request(this.servidor())
      .get(`/api/v1/ordens-servico/${ordemServicoId}/status`)
      .set('Authorization', `Bearer ${this.tokenRecepcionista}`);
    this.esperarStatus(resposta.status, 200, 'consultar o status da OS');
    return (resposta.body as { status: string }).status;
  }

  async lancarServicosInsumos(
    ordemServicoId: string,
    totais: { valor_total_servicos: number; valor_total_pecas: number }
  ): Promise<void> {
    const resposta = await request(this.servidor())
      .patch(`/api/v1/ordens-servico/${ordemServicoId}/servicos-insumos`)
      .set('Authorization', `Bearer ${this.tokenMecanico}`)
      .send(totais);
    this.esperarStatus(resposta.status, 200, 'lançar serviços e insumos');
  }

  async ordemDaOs(ordemServicoId: string): Promise<OrdemDeServico> {
    return this.app.get(OrdemServicoRepository).findOne(ordemServicoId);
  }

  /** Nomes dos eventos de integração que a OS publicou (o publicador só grava `os.eventos.v1`). */
  publicadosPelaOs(): string[] {
    return [...this.publicadosNoOs];
  }

  async encerrar(): Promise<void> {
    try {
      const prisma = this.prisma();
      await prisma.ordemServico.deleteMany({ where: { id: { in: this.osCriadas } } });
      await prisma.peca.deleteMany({ where: { id: { in: this.pecasCriadas } } });
      await prisma.cliente.deleteMany({ where: { documento: this.documentoCliente } });
      await cleanupTestUser(prisma, this.emailRecepcionista);
      await cleanupTestUser(prisma, this.emailMecanico);
    } finally {
      await this.app.close();
    }
  }

  private registrarPublicacao(evento: EventoIntegracao): Promise<void> {
    this.publicadosNoOs.push(evento.constructor.name);
    return Promise.resolve();
  }

  private prisma(): PrismaService {
    return this.app.get(PrismaService);
  }

  private servidor(): Application {
    return this.app.getHttpServer() as unknown as Application;
  }

  private esperarStatus(recebido: number, esperado: number, acao: string): void {
    if (recebido !== esperado) {
      throw new Error(`Falha ao ${acao}: HTTP ${recebido}, esperado ${esperado}`);
    }
  }
}
