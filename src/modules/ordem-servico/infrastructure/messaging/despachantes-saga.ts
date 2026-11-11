import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import type { AtualizarStatusEmDiagnosticoHandler } from '../../application/event-handlers/atualizar-status-em-diagnostico.handler';
import type { AtualizarStatusExecucaoIniciadaHandler } from '../../application/event-handlers/atualizar-status-execucao-iniciada.handler';
import type { AtualizarStatusFinalizadaHandler } from '../../application/event-handlers/atualizar-status-finalizada.handler';
import type { AtualizarStatusAguardandoAprovacaoHandler } from '../../application/event-handlers/atualizar-status-aguardando-aprovacao.handler';
import type { VerificarNecessidadePecasHandler } from '../../application/event-handlers/verificar-necessidade-pecas.handler';
import type { AtualizarStatusEncerradaSemExecucaoHandler } from '../../application/event-handlers/atualizar-status-encerrada-sem-execucao.handler';
import type { RegistrarPagamentoConfirmadoHandler } from '../../application/event-handlers/registrar-pagamento-confirmado.handler';
import { DiagnosticoIniciado } from '../../domain/events/diagnostico-iniciado.event';
import { ExecucaoIniciada } from '../../domain/events/execucao-iniciada.event';
import { ExecucaoConcluida } from '../../domain/events/execucao-concluida.event';
import { OrcamentoGerado } from '../../domain/events/orcamento-gerado.event';
import { OrcamentoAprovado } from '../../domain/events/orcamento-aprovado.event';
import { OrcamentoRecusado } from '../../domain/events/orcamento-recusado.event';
import { PagamentoConfirmado } from '../../domain/events/pagamento-confirmado.event';
import { PagamentoRecusado } from '../../domain/events/pagamento-recusado.event';
import type { Despachante } from './processador-mensagens-saga';

type Dados = Parameters<Despachante>[0];

// Payload sem o campo do contrato é erro de negócio: vai direto à DLT, sem retry.
function texto(data: Dados, campo: string): string {
  const valor = data[campo];
  if (typeof valor !== 'string' || valor.length === 0) {
    throw new DomainException(`Campo ${campo} ausente ou inválido no payload`);
  }
  return valor;
}

function numero(data: Dados, campo: string): number {
  const valor = data[campo];
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new DomainException(`Campo ${campo} ausente ou inválido no payload`);
  }
  return valor;
}

/** Eventos de `execucao.eventos.v1` consumidos pelo OS Service e o handler de cada um. */
export function despachantesExecucao(handlers: {
  emDiagnostico: AtualizarStatusEmDiagnosticoHandler;
  execucaoIniciada: AtualizarStatusExecucaoIniciadaHandler;
  finalizada: AtualizarStatusFinalizadaHandler;
}): Record<string, Despachante> {
  return {
    DiagnosticoIniciado: ({ ordemServicoId }) =>
      handlers.emDiagnostico.handle(new DiagnosticoIniciado(ordemServicoId)),
    ExecucaoIniciada: ({ ordemServicoId }) =>
      handlers.execucaoIniciada.handle(new ExecucaoIniciada(ordemServicoId)),
    ExecucaoConcluida: ({ ordemServicoId }) =>
      handlers.finalizada.handle(new ExecucaoConcluida(ordemServicoId)),
  };
}

/**
 * Eventos de `billing.eventos.v1` consumidos pelo OS Service (`event-catalog.md`). A
 * `EtapaDaSagaFalhou` do Billing fica de fora: a reação a ela é a compensação (#338).
 */
export function despachantesBilling(handlers: {
  aguardandoAprovacao: AtualizarStatusAguardandoAprovacaoHandler;
  verificarNecessidadePecas: VerificarNecessidadePecasHandler;
  encerradaSemExecucao: AtualizarStatusEncerradaSemExecucaoHandler;
  pagamentoConfirmado: RegistrarPagamentoConfirmadoHandler;
}): Record<string, Despachante> {
  return {
    OrcamentoGerado: (data) =>
      handlers.aguardandoAprovacao.handleOrcamentoGerado(
        new OrcamentoGerado(data.ordemServicoId, texto(data, 'orcamentoId'))
      ),
    OrcamentoAprovado: (data) =>
      handlers.verificarNecessidadePecas.handle(
        new OrcamentoAprovado(
          data.ordemServicoId,
          texto(data, 'orcamentoId'),
          numero(data, 'valorTotalPecas')
        )
      ),
    OrcamentoRecusado: (data) =>
      handlers.encerradaSemExecucao.handle(
        new OrcamentoRecusado(data.ordemServicoId, texto(data, 'orcamentoId'))
      ),
    PagamentoConfirmado: (data) =>
      handlers.pagamentoConfirmado.handle(
        new PagamentoConfirmado(data.ordemServicoId, texto(data, 'pagamentoId'))
      ),
    PagamentoRecusado: (data) =>
      handlers.encerradaSemExecucao.handlePagamentoRecusado(
        new PagamentoRecusado(data.ordemServicoId, texto(data, 'pagamentoId'))
      ),
  };
}
