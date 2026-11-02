import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import type { IPublicadorIntegracao } from '../../../../shared/domain/interfaces/publicador-integracao.interface';
import {
  lerEnvelope,
  type EnvelopeRecebido,
} from '../../../../shared/infrastructure/mensageria/envelope';
import {
  ESPERA_MAXIMA_RETRY_MS,
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

/** Chama o handler de aplicação do tipo de evento, com o `ordemServicoId` do envelope. */
export type Despachante = (ordemServicoId: string) => Promise<void>;

export interface DependenciasProcessador {
  despachantes: Record<string, Despachante>;
  publicador: IPublicadorIntegracao;
  enviar: (topic: string, key: string | null, envelope: unknown) => Promise<void>;
  aguardar?: (ms: number) => Promise<void>;
  agora?: () => Date;
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
  private readonly aguardar: (ms: number) => Promise<void>;
  private readonly agora: () => Date;

  constructor(private readonly deps: DependenciasProcessador) {
    this.aguardar =
      deps.aguardar ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    this.agora = deps.agora ?? (() => new Date());
  }

  async processar(
    topic: string,
    chave: string | null,
    valor: Buffer | string | null
  ): Promise<void> {
    const bruto = this.parse(valor);
    if (topic === OS_DLT_TOPIC) {
      await this.processarDlt(bruto);
      return;
    }

    const envelope = lerEnvelope(bruto, chave);
    if (!envelope) {
      await this.enviarEnvelopeInvalido(topic, chave);
      return;
    }

    const despachar = this.deps.despachantes[envelope.eventType];
    if (!despachar) {
      this.logger.log(`${envelope.eventType} em ${topic} não é consumido pelo OS Service: ack`);
      return;
    }

    const { ordemServicoId } = envelope.data;
    await runWithLogContext({ ordemServicoId, eventId: envelope.eventId }, async () => {
      if (topic === OS_RETRY_TOPIC && envelope.retry) {
        const espera = Date.parse(envelope.retry.notBefore) - this.agora().getTime();
        if (espera > 0) await this.aguardar(Math.min(espera, ESPERA_MAXIMA_RETRY_MS));
      }
      try {
        await despachar(ordemServicoId);
        this.logger.log(`${envelope.eventType} processado: OS ${ordemServicoId}`);
      } catch (erro) {
        await this.tratarFalha(envelope, erro);
      }
    });
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

  // A DLT não é o fim da linha (ADR-0018): a mensagem esgotada vira EtapaDaSagaFalhou. Se a
  // publicação falhar, o erro sobe e o kafkajs entrega a mensagem da DLT de novo.
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

    await this.deps.publicador.publicar(
      new EtapaDaSagaFalhou(
        'os-service',
        eventType,
        ordemServicoId,
        etapa,
        mensagem.lastError ?? 'retry esgotado'
      )
    );
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
