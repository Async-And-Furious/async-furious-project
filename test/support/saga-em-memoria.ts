import { ProcessadorMensagensSaga } from '../../src/modules/ordem-servico/infrastructure/messaging/processador-mensagens-saga';
import {
  despachantesBilling,
  despachantesExecucao,
} from '../../src/modules/ordem-servico/infrastructure/messaging/despachantes-saga';
import { AtualizarStatusEmDiagnosticoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-em-diagnostico.handler';
import { AtualizarStatusExecucaoIniciadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-execucao-iniciada.handler';
import { AtualizarStatusFinalizadaHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-finalizada.handler';
import { AtualizarStatusAguardandoAprovacaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-aguardando-aprovacao.handler';
import { VerificarNecessidadePecasHandler } from '../../src/modules/ordem-servico/application/event-handlers/verificar-necessidade-pecas.handler';
import { AtualizarStatusEncerradaSemExecucaoHandler } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-encerrada-sem-execucao.handler';
import { RegistrarPagamentoConfirmadoHandler } from '../../src/modules/ordem-servico/application/event-handlers/registrar-pagamento-confirmado.handler';
import { StatusTransitionService } from '../../src/modules/ordem-servico/domain/services/status-transition.service';
import {
  OrdemDeServico,
  type OSStatus,
} from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import type { HistoricoStatus } from '../../src/modules/ordem-servico/domain/entities/historico-status.entity';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../src/modules/ordem-servico/domain/interfaces/status-history.interface';
import type { IEmissorEventos } from '../../src/shared/domain/interfaces/emissor-eventos.interface';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import type { DomainEvent } from '../../src/shared/domain/events/domain-event.base';
import { EntityNotFoundException } from '../../src/shared/domain/exceptions/entity-not-found.exception';

export const OS_ID = 'os-1';

export interface EstadoOs {
  status: OSStatus;
  reserva: boolean;
  iniciadaEm: Date | null;
  pagoEm: Date | null;
}

const CAMPOS: Record<string, keyof EstadoOs> = {
  status: 'status',
  reserva_pecas_pendente: 'reserva',
  iniciada_em: 'iniciadaEm',
  pago_em: 'pagoEm',
};

/**
 * OS Service em memória para os testes de consumo: envelope → processador → handlers reais →
 * repositório em que cada gravação condicionada avalia a condição no estado do momento, como o
 * UPDATE ... WHERE no banco. `null` = OS inexistente.
 */
export function montarSagaEmMemoria(inicial: Partial<EstadoOs> | null) {
  let estado: EstadoOs | null = inicial && {
    status: 'RECEIVED',
    reserva: false,
    iniciadaEm: null,
    pagoEm: null,
    ...inicial,
  };
  const historico: HistoricoStatus[] = [];

  const os = () => {
    if (!estado) throw new EntityNotFoundException('OrdemDeServico', OS_ID);
    return Object.assign(new OrdemDeServico(), {
      id: OS_ID,
      status: estado.status,
      reservaPecasPendente: estado.reserva,
      iniciada_em: estado.iniciadaEm,
      pago_em: estado.pagoEm,
    });
  };
  const aplicar = (data: Record<string, unknown>) => {
    if (!estado) return;
    for (const [coluna, valor] of Object.entries(data)) {
      const campo = CAMPOS[coluna];
      if (campo) estado = { ...estado, [campo]: valor };
    }
  };
  const casa = (condicao: Record<string, unknown>) =>
    !!estado &&
    Object.entries(condicao).every(([coluna, valor]) => {
      const campo = CAMPOS[coluna];
      return !campo || estado![campo] === valor;
    });

  const osRepo = {
    findOne: jest.fn(() => Promise.resolve(os())),
    update: jest.fn((_id: string, data: Record<string, unknown>) => {
      aplicar(data);
      return Promise.resolve(os());
    }),
    atualizarSeCondicao: jest.fn(
      (_id: string, condicao: Record<string, unknown>, data: Record<string, unknown>) => {
        if (!casa(condicao)) return Promise.resolve(false);
        aplicar(data);
        return Promise.resolve(true);
      }
    ),
  } as unknown as IOrdemServicoRepository;
  const historicoRepo = {
    findByOrdemServicoId: jest.fn(() => Promise.resolve([...historico])),
    create: jest.fn((linha: HistoricoStatus) => {
      historico.push(linha);
      return Promise.resolve(linha);
    }),
  } as unknown as IStatusHistoryRepository;
  // OrdemServicoEmExecucao grava iniciada_em, como o IniciarMonitoramentoTempoHandler in-process.
  const emissor: jest.Mocked<IEmissorEventos> = {
    emitir: jest.fn((evento: DomainEvent) => {
      if (estado && evento.constructor.name === 'OrdemServicoEmExecucao')
        estado = { ...estado, iniciadaEm: new Date() };
      return Promise.resolve();
    }),
  };
  const transicao = new StatusTransitionService();
  const enviar = jest
    .fn<Promise<void>, [string, string | null, unknown]>()
    .mockResolvedValue(undefined);
  const publicador: jest.Mocked<IPublicadorIntegracao> = {
    publicar: jest.fn().mockResolvedValue(undefined),
  };

  const processador = new ProcessadorMensagensSaga({
    despachantes: {
      ...despachantesExecucao({
        emDiagnostico: new AtualizarStatusEmDiagnosticoHandler(osRepo, emissor, transicao),
        execucaoIniciada: new AtualizarStatusExecucaoIniciadaHandler(osRepo, emissor, transicao),
        finalizada: new AtualizarStatusFinalizadaHandler(osRepo, historicoRepo, emissor, transicao),
      }),
      ...despachantesBilling({
        aguardandoAprovacao: new AtualizarStatusAguardandoAprovacaoHandler(osRepo),
        verificarNecessidadePecas: new VerificarNecessidadePecasHandler(
          osRepo,
          historicoRepo,
          emissor
        ),
        encerradaSemExecucao: new AtualizarStatusEncerradaSemExecucaoHandler(
          osRepo,
          emissor,
          historicoRepo,
          transicao
        ),
        pagamentoConfirmado: new RegistrarPagamentoConfirmadoHandler(osRepo, historicoRepo),
      }),
    },
    publicador,
    enviar,
  });

  const consumir = (eventType: string, data: Record<string, unknown> = {}, topic = 'qualquer') =>
    processador.processar(
      topic,
      OS_ID,
      JSON.stringify({
        eventId: `evt-${eventType}`,
        eventType,
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        correlationId: OS_ID,
        producer: 'teste',
        data: { ordemServicoId: OS_ID, ...data },
      })
    );

  const topicosEnviados = () => enviar.mock.calls.map(([topic]) => topic);

  return {
    consumir,
    estado: () => estado,
    historico,
    emissor,
    enviar,
    topicosEnviados,
  };
}
