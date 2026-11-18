# Issue #337 — Estado documentado da Saga no OS Service

## Escopo

Distinguir o fluxo alvo aprovado da Saga do comportamento implementado no OS Service em `origin/develop` (`f175716`). Manter o desenho existente; registrar que o consumo/compensação OS para `EtapaDaSagaFalhou` emitida pelo Billing depende da #338 e não está disponível no dispatcher Billing.

Corrigir a descrição de `HistoricoStatusOS`: handlers/use cases escrevem por caminhos específicos via `StatusHistoryRepository`; `OrdemServicoRepository.update` não grava automaticamente esse histórico. Não afirmar cobertura universal nem atomicidade entre gravação do status e histórico.

## Fora do escopo

Mudanças de código, mudança do desenho aprovado, afirmações sobre implementação dos outros serviços ou estado HML.
