# Testes BDD do fluxo da Saga

Suíte em Gherkin do caminho feliz da Ordem de Serviço entre OS Service, Billing Service e Execução e Produção (Feature [#340](https://github.com/Async-And-Furious/async-furious-project/issues/340)). Decisão de ferramenta, localização e ambiente: [ADR-0023](../../docs/adr/0023-ferramenta-bdd-suite-saga.md). O desenho do fluxo é a fonte dos cenários: [`saga-flow.md`](../../docs/architecture/saga-flow.md) e [`event-catalog.md`](../../docs/architecture/event-catalog.md).

## Como rodar

```bash
# PostgreSQL de teste (nunca o banco de desenvolvimento). Cliente Prisma e migrações antes da primeira execução:
pnpm exec prisma generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/<banco_de_teste> pnpm exec prisma migrate deploy

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/<banco_de_teste> \
JWT_SECRET=ci-disposable-jwt-secret \
JWT_CUSTOMER_PUBLIC_KEY=test-jwt-customer-public-key \
pnpm run test:bdd
```

`test:bdd` usa `test/jest-bdd.json` (`testRegex` `\.steps\.ts$`) e roda com `--runInBand`, como o e2e. No CI, o passo "Run BDD tests (fluxo da Saga)" roda no job `test` (ver `.github/workflows/tests.yml`), depois do e2e e antes do build. Um passo que quebra reprova o check "Run All Tests".

## Estado atual

| Parte | Situação |
|---|---|
| `features/fluxo-saga-os.feature` | Caminho feliz executável. O cenário de pagamento recusado segue no arquivo com a tag `@depende-338` (pulado). |
| `steps/fluxo-saga-os.steps.ts` | Feito. O caminho feliz roda; o cenário pulado tem passos marcados `pending()`. |
| `support/ambiente-saga.ts` | Feito. Sobe o `AppModule` real contra o PostgreSQL de teste e monta o consumidor da saga simulado. |
| `jest-cucumber@4.5.0` | Instalado como devDependency, com versão exata (o parse de `# language: pt` foi verificado só nesta versão). |
| `test/jest-bdd.json` e script `test:bdd` | Feitos. |
| Passo de BDD no CI | Feito, no job `test` (ver acima). |
| `docker-compose.bdd.yml` (Kafka, tópicos, Billing e Execução reais) | Não existe. Dívida documentada abaixo. |
| Cenário de compensação (`@depende-338`) | Pulado até a #338 ser mesclada. |

## O que é simulado

O OS Service roda de verdade. O resto da saga não sobe, e os eventos dele entram pelo mesmo caminho do consumidor Kafka:

| Componente | Como entra na suíte |
|---|---|
| OS Service | App Nest real (`AppModule`), com o prefixo `api/v1` e a `ValidationPipe` de `src/main.ts`. Banco: PostgreSQL de teste. |
| Execução e Produção | Eventos `DiagnosticoIniciado`, `ExecucaoIniciada` e `ExecucaoConcluida` entregues ao `ProcessadorMensagensSaga`, com os despachantes de `despachantes-saga.ts` e os handlers reais do módulo. O envelope segue a ADR-0018. |
| Billing Service | Evento `PagamentoConfirmado` entregue da mesma forma, no tópico `billing.eventos.v1`. O webhook do Mercado Pago não é chamado: a confirmação do pagamento é o evento simulado. |
| Mercado Pago | Stub (`mercadoPago` em `ambiente-saga.ts`) que devolve o link de checkout e não faz chamada de rede. |
| Kafka | Não sobe. O publicador do OS é substituído por um que registra os eventos publicados (o real grava só `os.eventos.v1`). |
| mongo | Não é usado: o OS Service não tem read model no código atual (ADR-0019 ainda não implementada no monólito). |

Se o consumidor simulado mandar uma mensagem para retry ou DLT, a entrega falha com o nome do passo. Sem Kafka real, nada reentregaria a mensagem, e o erro passaria despercebido.

Leituras de estado: o status da OS é lido por HTTP (`GET /api/v1/ordens-servico/{id}/status`). O `Orcamento`, o `pago_em` e o estoque são lidos pelo repositório do módulo e pelo Prisma, porque a ADR-0023 (item 3) ainda não decidiu a rota de leitura desses dados.

Esperas: o consumidor simulado é chamado de forma síncrona, então a suíte não tem espera por evento e não usa `sleep`. A regra de consulta em laço com prazo (ADR-0023, seção 3) volta a valer quando o Kafka real entrar.

## Ajustes ao `.feature` original

O texto de [`saga-flow.md`](../../docs/architecture/saga-flow.md) é o alvo. Onde o código de hoje não faz o que o texto dizia, o passo foi ajustado para o comportamento real, e o motivo está abaixo.

| Passo original | Ajuste | Motivo |
|---|---|---|
| "o OS Service, o Billing Service e a Execução e Produção estão no ar" | Só o OS Service sobe; Billing e Execução são simulados | Compose fora do escopo reduzido (03/11). |
| "o Kafka, o PostgreSQL, o mongo e o stub do Mercado Pago estão disponíveis" | "o PostgreSQL de teste e o stub do Mercado Pago" | Sem broker e sem read model no código atual. |
| "a Execucao da OS está em AGUARDANDO_DIAGNOSTICO", "a Execucao está em EM_DIAGNOSTICO", "...EM_REPARO", "...CONCLUIDA", "a Execucao está em AGUARDANDO_REPARO" | Removidos | Estado da Execução, que é simulada. A suíte não observa o que ela guarda. |
| "o evento DiagnosticoIniciado / ExecucaoIniciada / ExecucaoConcluida é publicado em execucao.eventos.v1" | Removidos; o passo vira "a Execução publica ..." | Ver acima: a publicação é a própria entrega simulada. |
| "o mecânico inicia o diagnóstico / o reparo / conclui (PATCH /api/v1/execucoes/...)" | "a Execução publica ..." | As rotas `/execucoes` são do serviço de Execução, que não sobe. |
| "o evento OrcamentoGerado é publicado em billing.eventos.v1" | Removido | Hoje o OS gera o orçamento em processo (`GerarOrcamentoHandler`, transitório até a #330). Não há publicação no broker. |
| "o cliente aprova o orçamento (PATCH /api/v1/orcamentos/{ordemServicoId}/aprovar)" | `PATCH /api/v1/ordens-servico/{id}/orcamento/aprovar` | Rota real do OS Service. |
| "o Pagamento está em AGUARDANDO_PAGAMENTO" e "o evento OrcamentoAprovado é publicado em billing.eventos.v1" | Removidos | O `Pagamento` é do Billing (simulado). O OS não publica `OrcamentoAprovado` no broker: o `PonteEventosIntegracaoListener` só leva `OrdemServicoRecebida`, `OrcamentoCalculado` e `EtapaDaSagaFalhou`. |
| "as peças da OS são reservadas" | Mantido, observado pelo estoque da peça (5 → 4) | Efeito real: a reserva debita o estoque em processo. |
| "o Mercado Pago notifica o pagamento aprovado (POST /api/v1/webhooks/mercado-pago ...)" | "o Billing publica PagamentoConfirmado" | Webhook e reconsulta são do Billing (simulado). |
| "o Pagamento está em CONFIRMADO" e "o evento PagamentoConfirmado é publicado..." | Removidos | Estado do Billing. |
| "a OS registra pago_em e continua em AWAITING_APPROVAL" | Mantido | Efeito no OS: `RegistrarPagamentoConfirmadoHandler` grava `pago_em` sem mudar o status. |
| "a Execucao está em CANCELADA", "o HistoricoStatusOS registra o motivo..." (cenário de falha) | Não revisados nesta entrega | Cenário `@depende-338`, pulado. |
| Cabeçalho "por eventos reais no Kafka" | "por eventos" | Não há Kafka real na suíte. |

## Por que cobertura e BDD são métricas distintas

A cobertura (ADR-0014, 80%) mede as linhas, ramos e funções de `src/`, com `test:cov` e o `jest.config.js`. A suíte BDD não entra nessa conta: os arquivos daqui são `*.feature` e `*.steps.ts`, que a configuração unitária não executa, e `collectCoverageFrom` só olha `src/`. A cobertura diz quanto código foi exercitado por qualquer teste. O BDD diz se um caminho de negócio da saga funciona de ponta a ponta. Um número alto de cobertura não mostra o fluxo testado, e a suíte BDD não altera o número.

## Dívidas (não entram nesta entrega)

1. **Compose com Kafka, Billing e Execução reais** (ADR-0023, seção 3 e item 1 de "Em aberto"). Hoje os eventos são simulados. Quando o compose existir, o passo do CI passa a subir a stack.
2. **Cenário de falha** (`@depende-338`): pulado pela tag até a #338. Quando a #338 entrar, remover a tag e o `pending()` do cenário na mesma PR.
3. **Rota ou acesso de leitura** para `Orcamento`, `pago_em` e reserva (ADR-0023, item 3).
4. **Publicação de `OrcamentoAprovado` e `OrcamentoGerado` no broker** (ver tabela de ajustes). Quando a #330 e a #338 entrarem, a suíte deve afirmar a publicação, e não o efeito em processo.
5. **Duplicação da composição do consumidor**: `ambiente-saga.ts` monta o `ProcessadorMensagensSaga` com os mesmos despachantes de `ordem-servico.module.ts`. Se a fábrica do módulo mudar, o teste precisa acompanhar.
6. **Verificação do parse** do `# language: pt` só na versão 4.5.0 do `jest-cucumber` (ADR-0023, seção 1). Trocar a versão exige repetir o parse.

## Regras da suíte

- Sem `sleep` fixo. Enquanto o consumidor for síncrono, não há espera; quando o Kafka real entrar, esperas de estado serão consultas em laço com prazo explícito.
- Sem `jest.retryTimes` nem reexecução de job para esconder falha intermitente.
- A entrega simulada falha se o consumidor mandar a mensagem para retry ou DLT.
- Nenhum teste depende de HML, de cluster ou de credenciais AWS.
- Cada cenário sobe e encerra o próprio app; os registros criados (OS, peça, cliente, usuários) são apagados ao fim.
- Os cenários usam só o que o código atual faz; quando a implementação mudar, o `.feature` muda junto, com o motivo registrado aqui.
