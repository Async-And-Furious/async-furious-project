import type { AtualizarStatusEmDiagnosticoHandler } from '../../application/event-handlers/atualizar-status-em-diagnostico.handler';
import type { AtualizarStatusExecucaoIniciadaHandler } from '../../application/event-handlers/atualizar-status-execucao-iniciada.handler';
import type { AtualizarStatusFinalizadaHandler } from '../../application/event-handlers/atualizar-status-finalizada.handler';
import { DiagnosticoIniciado } from '../../domain/events/diagnostico-iniciado.event';
import { ExecucaoIniciada } from '../../domain/events/execucao-iniciada.event';
import { ExecucaoConcluida } from '../../domain/events/execucao-concluida.event';
import type { Despachante } from './processador-mensagens-saga';

/** Eventos de `execucao.eventos.v1` consumidos pelo OS Service e o handler de cada um. */
export function despachantesExecucao(handlers: {
  emDiagnostico: AtualizarStatusEmDiagnosticoHandler;
  execucaoIniciada: AtualizarStatusExecucaoIniciadaHandler;
  finalizada: AtualizarStatusFinalizadaHandler;
}): Record<string, Despachante> {
  return {
    DiagnosticoIniciado: (id) => handlers.emDiagnostico.handle(new DiagnosticoIniciado(id)),
    ExecucaoIniciada: (id) => handlers.execucaoIniciada.handle(new ExecucaoIniciada(id)),
    ExecucaoConcluida: (id) => handlers.finalizada.handle(new ExecucaoConcluida(id)),
  };
}
