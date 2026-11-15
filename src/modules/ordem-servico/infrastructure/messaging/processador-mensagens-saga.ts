import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import type { IPublicadorIntegracao } from '../../../../shared/domain/interfaces/publicador-integracao.interface';
import {
  lerEnvelope,
  type EnvelopeRecebido,
} from '../../../../shared/infrastructure/mensageria/envelope';
import {
  MAX_TENTATIVAS,
  OS_DLT_TOPIC,
  OS_PRODUCER,
  OS_RETRY_TOPIC,
  backoffMs,
} from '../../../../shared/infrastructure/mensageria/kafka.config';
import { runWithLogContext } from '../../../../shared/infrastructure/logging/pino-logger.config';
import {
  EtapaDaSagaFalhou,
  type EtapaDaSaga,
} from '../../domain/events/etapa-da-saga-falhou.event';

/** Chama o handler de aplicação do tipo de evento com o `data` do envelope. */
export type Despachante = (data: EnvelopeRecebido['data']) => Promise<void>;

export interface DependenciasProcessador {
  despachantes: Record<string, Despachante>;
  publicador: IPublicadorIntegracao;
  enviar: (topic: string, key: string | null, envelope: unknown) => Promise<void>;
  agora?: () => Date;
}

/**
 * Mensagem do retry topic cujo `notBefore` ainda não chegou: não foi processada. O consumer
 * pausa a partição e volta a entregar a mesma mensagem depois de `esperaMs`.
 */
export interface Adiamento {
  esperaMs: number;
}

// `saga-flow.md` §3, "Evento original → etapa", linhas do OS Service.
export const ETAPA_POR_EVENTO: Record<string, EtapaDaSaga> = {
  DiagnosticoIniciado: 'diagnostico',
  OrcamentoGerado: 'orcamento',
  OrcamentoAprovado: 'aprovacao-pagamento',
  OrcamentoRecusado: 'aprovacao-pagamento',
  PagamentoRecusado: 'aprovacao-pagamento',
  ExecucaoIniciada: 'reparo',
  ExecucaoConcluida: 'reparo',
};

// Ficam na DLT para replay manual, sem gerar EtapaDaSagaFalhou: PagamentoConfirmado (o
// pagamento é válido e o reparo pode já ter começado) e EtapaDaSagaFalhou (evita laço).
const SEM_EVENTO_NA_DLT = new Set(['PagamentoConfirmado', 'EtapaDaSagaFalhou']);

const mensagemDeErro = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

/**
 * Processa uma mensagem consumida pelo `os-consumer`, com a classificação de falha da
 * ADR-0018. A guarda de estado fica nos handlers: "já-passou" termina sem erro (ack);
 * "ainda-não" lança `FalhaRetentavelException` e vai ao retry topic; `DomainException`
 * (erro de negócio, inclusive OS inexistente) vai direto à DLT. Na DLT, a mensagem vira
 * `EtapaDaSagaFalhou` com a `etapa` derivada do `eventType`.
 *
 * Os handlers são chamados diretamente, e não pelo EventEmitter2: o `@OnEvent` suprime a
 * rejeição, e o consumidor precisa dela para decidir entre ack, retry e DLT.
 */
export class ProcessadorMensagensSaga {
  private readonly logger = new Logger(ProcessadorMensagensSaga.name);
  private readonly agora: () => Date;

  constructor(private readonly deps: DependenciasProcessador) {
    this.agora = deps.agora ?? (() => new Date());
  }

  /** Devolve um `Adiamento` quando a mensagem do retry topic ainda não deve ser processada. */
  async processar(
    topic: string,
    chave: string | null,
    valor: Buffer | string | null
  ): Promise<Adiamento | null> {
    const bruto = this.parse(valor);
    if (topic === OS_DLT_TOPIC) {
      await this.processarDlt(bruto);
      return null;
    }

    const envelope = lerEnvelope(bruto, chave);
    if (!envelope) {
      await this.enviarEnvelopeInvalido(topic, chave);
      return null;
    }

    const despachar = this.deps.despachantes[envelope.eventType];
    if (!despachar) {
      this.logger.log(`${envelope.eventType} em ${topic} não é consumido pelo OS Service: ack`);
      return null;
    }

    if (topic === OS_RETRY_TOPIC && envelope.retry) {
      const esperaMs = Date.parse(envelope.retry.notBefore) - this.agora().getTime();
      if (esperaMs > 0) return { esperaMs };
    }

    const { ordemServicoId } = envelope.data;
    await runWithLogContext({ ordemServicoId, eventId: envelope.eventId }, async () => {
      try {
        await despachar(envelope.data);
        this.logger.log(`${envelope.eventType} processado: OS ${ordemServicoId}`);
      } catch (erro) {
        await this.tratarFalha(envelope, erro);
      }
    });
    return null;
  }

  private async tratarFalha(envelope: EnvelopeRecebido, erro: unknown): Promise<void> {
    const tentativa = (envelope.retry?.attempt ?? 0) + 1;
    const agora = this.agora();
    const lastError = mensagemDeErro(erro);
    const firstFailedAt = envelope.retry?.firstFailedAt ?? agora.toISOString();
    const chave = envelope.data.ordemServicoId;
    const negocio = erro instanceof DomainException;

    if (negocio || tentativa >= MAX_TENTATIVAS) {
      this.logger.error(
        `${envelope.eventType} da OS ${chave} vai para ${OS_DLT_TOPIC} (tentativa ${tentativa}${negocio ? ', erro de negócio' : ''}): ${lastError}`
      );
      await this.deps.enviar(OS_DLT_TOPIC, chave, {
        ...envelope,
        retry: { attempt: tentativa, firstFailedAt, notBefore: agora.toISOString() },
        lastError,
      });
      return;
    }

    const notBefore = new Date(agora.getTime() + backoffMs(tentativa)).toISOString();
    this.logger.warn(
      `${envelope.eventType} da OS ${chave} vai para ${OS_RETRY_TOPIC} (tentativa ${tentativa}): ${lastError}`
    );
    await this.deps.enviar(OS_RETRY_TOPIC, chave, {
      ...envelope,
      retry: { attempt: tentativa, firstFailedAt, notBefore },
      lastError,
    });
  }

  // A DLT não é o fim da linha (ADR-0018): a mensagem esgotada vira EtapaDaSagaFalhou. Como o OS
  // não assina o próprio tópico, aplica a compensação local no mesmo ato (`saga-flow.md` §3,
  // "Origem da falha e assinaturas"). Se a publicação ou a compensação falhar, o erro sobe e o
  // kafkajs entrega a mensagem da DLT de novo; as duas pontas são idempotentes. Erro de negócio
  // na compensação (ex.: OS inexistente) não se resolve com reentrega: fica no log, sem laço.
  private async processarDlt(bruto: unknown): Promise<void> {
    const mensagem = (bruto ?? {}) as Partial<EnvelopeRecebido>;
    const eventType = mensagem.eventType ?? 'desconhecido';
    const ordemServicoId = mensagem.data?.ordemServicoId;
    const etapa = ETAPA_POR_EVENTO[eventType];

    if (typeof ordemServicoId !== 'string' || SEM_EVENTO_NA_DLT.has(eventType) || !etapa) {
      this.logger.warn(
        `${eventType} na ${OS_DLT_TOPIC} fica para replay manual, sem EtapaDaSagaFalhou (OS ${ordemServicoId ?? 'desconhecida'})`
      );
      return;
    }

    const falha = new EtapaDaSagaFalhou(
      'os-service',
      eventType,
      ordemServicoId,
      etapa,
      mensagem.lastError ?? 'retry esgotado'
    );
    await this.deps.publicador.publicar(falha);

    const compensar = this.deps.despachantes.EtapaDaSagaFalhou;
    if (!compensar) return;
    try {
      await compensar({
        ordemServicoId,
        servicoOrigem: falha.servicoOrigem,
        eventTypeOriginal: falha.eventTypeOriginal,
        etapa: falha.etapa,
        motivo: falha.motivo,
      });
    } catch (erro) {
      if (!(erro instanceof DomainException)) throw erro;
      this.logger.error(
        `Compensação local de ${eventType} da OS ${ordemServicoId} não aplicada (replay manual): ${mensagemDeErro(erro)}`
      );
    }
  }

  private async enviarEnvelopeInvalido(topic: string, chave: string | null): Promise<void> {
    const agora = this.agora().toISOString();
    const eventId = randomUUID();
    this.logger.error(`Envelope inválido em ${topic} (chave ${chave ?? 'nula'}): vai para a DLT`);
    await this.deps.enviar(OS_DLT_TOPIC, chave, {
      eventId,
      eventType: 'EnvelopeInvalido',
      eventVersion: 1,
      occurredAt: agora,
      correlationId: chave ?? eventId,
      producer: OS_PRODUCER,
      data: { topicoOrigem: topic, ordemServicoId: chave },
      retry: { attempt: 1, firstFailedAt: agora, notBefore: agora },
      lastError: 'Envelope inválido',
    });
  }

  private parse(valor: Buffer | string | null): unknown {
    if (valor === null) return null;
    try {
      return JSON.parse(valor.toString()) as unknown;
    } catch {
      return null;
    }
  }
}
