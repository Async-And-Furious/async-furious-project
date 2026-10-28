# ADR-0023: Ferramenta de BDD e localização da suíte do fluxo da Saga

## Status

Proposta — escrita em 28/10/2026 para a Feature [#340](https://github.com/Async-And-Furious/async-furious-project/issues/340); aguarda aceite do grupo.

Os itens marcados como **decisão do grupo** na seção [Em aberto](#em-aberto) não estão fechados por esta ADR.

## Contexto

O enunciado da Fase 4 exige "pelo menos um fluxo completo testado com BDD" (p.4) e a demonstração da "execução do Saga Pattern e tratamento de falhas" (p.5). Não especifica a ferramenta nem diz onde mora um teste que atravessa mais de um repositório.

Hoje o projeto não tem BDD: o `package.json` declara Jest 29, `ts-jest` e supertest, não há pacote de Gherkin e não há arquivo `.feature`. Os testes são `*.spec.ts` (unitários, configurados em `jest.config.js`) e `*.e2e-spec.ts` (configurados em `test/jest-e2e.json`), rodados com o mesmo runner Jest.

A saga é coreografada ([ADR-0016](./0016-saga-coreografada.md)): não existe um orquestrador cujo código descreva o fluxo inteiro. O fluxo está descrito em [`saga-flow.md`](../architecture/saga-flow.md) (§1 sequência, §3 matriz de falhas) e os eventos em [`event-catalog.md`](../architecture/event-catalog.md). Um teste BDD é a forma executável dessa descrição: cada cenário é um caminho da saga, e o build quebra quando o caminho deixa de funcionar.

Dois cenários são exigidos:

1. **Caminho feliz**, da abertura da OS até `FINISHED`, passando pelos três serviços por eventos reais no Kafka.
2. **Falha por pagamento recusado**, até `CLOSED_WITHOUT_EXECUTION`, com a compensação verificada em cada serviço afetado (OS libera a reserva de peças; Execução cancela a `Execucao`; Billing marca o `Pagamento` como `RECUSADO` sem estorno).

O segundo cenário só passa quando as compensações da [#338](https://github.com/Async-And-Furious/async-furious-project/issues/338) estiverem implementadas. O primeiro não depende dela.

Numeração: a ADR-0022 está reservada à integração com o Mercado Pago ([#325](https://github.com/Async-And-Furious/async-furious-project/issues/325)), então esta ADR usa a 0023.

## Decisão

### 1. Ferramenta: `jest-cucumber`

A suíte usa **`jest-cucumber`** sobre o Jest 29 que o projeto já tem:

- os cenários ficam em arquivos `.feature` em Gherkin, que o avaliador lê em Given/When/Then;
- cada passo é ligado a uma função dentro do próprio Jest, e o runner Jest e o supertest são os mesmos da suíte e2e; a configuração de execução (`test/jest-bdd.json`) segue o modelo de `test/jest-e2e.json`, com o mesmo `moduleNameMapper` para `@/`;
- não há segundo runner, segundo reporter nem segunda configuração de CI.

Os arquivos `.feature` são escritos em português, com a linha `# language: pt` no topo, por decisão desta entrega (a issue não fixa o idioma).

**Verificado em 28/10/2026** com `jest-cucumber@4.5.0` (dependência `@cucumber/gherkin@28.0.0`, peer `jest >=29.7.0`, compatível com o `^29.7.0` do projeto): o dialeto `pt` existe no pacote, e o parser lê o `.feature` desta entrega e traduz as palavras-chave (`Funcionalidade`, `Contexto`, `Cenário`, `Dado`, `Quando`, `Então`, `E`) para as equivalentes em inglês que o pacote usa internamente (`Feature`, `Background`, `Scenario`, `Given`, `When`, `Then`, `And`), mantendo os textos em português. A verificação foi só de parse (não há step definitions ainda, então não houve execução de passos). A instalação real entra na branch da #333, que altera `package.json` e o lockfile; ao trocar a versão do pacote, o parse deve ser repetido.

### 2. Onde a suíte mora: repositório do OS Service

**Decidido na issue #340 e registrado aqui para aceite do grupo.** A suíte mora em `test/bdd/` do repositório `async-furious-project` (OS Service):

```
test/bdd/
├── features/
│   └── fluxo-saga-os.feature      # cenários em Gherkin (pt)
├── steps/                         # step definitions (*.steps.ts), a criar
├── docker-compose.bdd.yml         # stack do CI, a criar
└── README.md
```

Configuração de execução: `test/jest-bdd.json`, a criar, com `testRegex` para `\.steps\.ts$`.

Por que no OS Service:

- o OS Service é quem abre a saga (recebe `POST /api/v1/ordens-servico`, com o prefixo global `api/v1` definido em `src/main.ts`, e publica `OrdemServicoRecebida`), consome `DiagnosticoIniciado`, `ExecucaoIniciada`, `ExecucaoConcluida`, `OrcamentoGerado`, `OrcamentoAprovado`, `OrcamentoRecusado`, `PagamentoConfirmado` e `PagamentoRecusado`, e hospeda o detector de OS parada. Um teste do fluxo começa e termina nele. O diagrama de `saga-flow.md` §1 escreve `POST /ordens-servico` sem o prefixo; corrigi-lo é trabalho separado.
- a ADR-0016 não tem orquestrador, então não existe um repositório natural para "o fluxo inteiro".
- não cria um pipeline a mais para manter.

Separação da cobertura unitária (exigência da issue): os arquivos da suíte não casam com nenhum padrão que a configuração unitária executa. `jest.config.js` roda `.*\.spec\.ts$`, `test/jest-e2e.json` roda `.e2e-spec.ts$`, e `collectCoverageFrom` mede apenas `src/**`. A configuração BDD não tem `coverageThreshold`. Os 80% da [ADR-0014](./0014-cobertura-minima-testes.md) continuam medindo só a suíte unitária, e o README do serviço deve dizer que são métricas distintas.

### 3. Ambiente de teste no CI: docker compose

No job de BDD do CI, `test/bdd/docker-compose.bdd.yml` sobe a stack inteira. Nenhum serviço é mockado além do Mercado Pago.

| Componente | Como sobe | Observação |
|---|---|---|
| OS Service | build do repositório em execução | imagem construída no próprio job |
| Billing Service | imagem (ver [Em aberto](#em-aberto), item 1) | consumida pelo compose |
| Execução e Produção | imagem (ver [Em aberto](#em-aberto), item 1) | consumida pelo compose |
| Kafka | broker único em modo KRaft, imagem com tag fixada | mesmo modo do cluster (ADR-0018) |
| Criação de tópicos | serviço one-shot que cria `os.eventos.v1`, `billing.eventos.v1`, `execucao.eventos.v1` e `<servico>.retry.v1` / `<servico>.dlt.v1` para `os`, `billing` e `execucao`, com 3 partições (ADR-0018, #314); o prefixo `<servico>` segue `*.eventos.v1` e é a confirmar com a #314 | termina com código 0 só depois de criar os tópicos |
| PostgreSQL | uma instância, com os bancos lógicos `os_service`, `billing` e `execucao_producao` e um usuário por serviço | nomes e isolamento da ADR-0020; criação por script de init |
| `mongo` | container com tag fixada, stand-in do DocumentDB do read model do OS Service | ADR-0019; o DocumentDB real só é validado no HML, em subnet privada |
| Stub do Mercado Pago | container HTTP que responde a criação da preference, a reconsulta `GET /v1/payments/{id}` e registra chamadas (inclusive de estorno) | o teste controla o status devolvido |

Regras de montagem:

- **Espera por condição, não por tempo.** Os serviços dependem do Kafka com `healthcheck` no broker e do serviço de criação de tópicos com `depends_on: condition: service_completed_successfully`. Não há `sleep` fixo.
- **Asserções eventuais com prazo.** Quando o teste espera uma mudança de estado que acontece por evento (ex.: `Execucao` em `AGUARDANDO_REPARO` depois de `PagamentoConfirmado`), ele consulta em laço com prazo explícito e falha no prazo. Não há `sleep`.
- **Sem retry automático.** A suíte não usa `jest.retryTimes` nem reexecução por job para esconder falha intermitente.
- **Webhook assinado pelo teste.** O teste envia `POST /api/v1/webhooks/mercado-pago` com `x-signature` calculada com o `MP_WEBHOOK_SECRET` que o compose injeta no Billing (ADR-0022, item 6). Em nenhum cenário o webhook é simulado sem assinatura.
- **Autenticação.** Os serviços validam JWT localmente (ADR-0021). O compose recebe a chave pública de teste, e o setup da suíte gera o par de chaves e assina os tokens de recepção e de mecânico.
- **Sem Gateway nem Authorizer.** A suíte chama os serviços pelas portas do compose. Ela testa a saga, não a borda (ADR-0021).
- **Portas no host.** O compose não publica portas que colidam com o ambiente local de desenvolvimento (PostgreSQL em `5433`).
- **Sem HML.** O teste não depende de cluster, AWS nem credenciais. Teste que depende de HML falha por motivo de infraestrutura e bloqueia merge.

O workflow que executa o compose e a suíte (job de BDD) não é criado nesta entrega. Quando for criado, deve rodar a cada PR do OS Service.

### 4. Critério de estabilidade

A suíte é considerada estável quando o job de BDD passa **três execuções consecutivas** no CI, sem reexecução manual e sem alteração de código entre elas. Uma falha que passa em uma reexecução conta como flaky e zera a contagem.

## Alternativas consideradas

### Ferramenta de BDD

- **`@cucumber/cucumber`** (oficial, Cucumber.js). Lê Gherkin de forma nativa e tem o melhor suporte a relatórios e a idiomas. Foi descartado porque traz runner, reporter e configuração de CI próprios, paralelos aos do Jest. O projeto passaria a ter dois runners e dois jeitos de rodar testes. Como o runner próprio não reaproveitaria o `test/jest-e2e.json` nem o supertest já configurados, isso contraria a exigência da issue de não introduzir um segundo runner.
- **`jest-cucumber`** (escolhido). Gherkin de verdade sobre o Jest que o projeto já usa. Reaproveita a configuração, o supertest e a estrutura de testes existentes.
- **supertest puro**, sem Gherkin, com `describe`/`it` em linguagem de negócio. É o mais simples e não cria dependência nova. Foi descartado porque o enunciado pede BDD, e o avaliador precisa ver Given/When/Then no repositório. O supertest continua sendo usado, dentro dos passos do `jest-cucumber`.

### Localização da suíte

- **Quarto repositório só de testes** (`repo-e2e`). Isolaria a suíte, mas cria mais um pipeline, mais um deploy e mais um repositório, e a Fase 4 já tem três serviços, cada um em seu repositório. Descartado pelo custo de manutenção e porque nenhuma etapa da saga é dona de um repositório de testes.
- **`repo-k8s-infra`**. Já provisiona Kafka e ALB por Terraform, mas mistura infraestrutura com comportamento de domínio. Descartado: o teste deveria rodar contra imagens de aplicação, e o repositório de infra não as constrói.
- **Repositório do Billing ou da Execução**. Descartado: o início da saga e o detector de OS parada são do OS Service, então o fluxo começaria fora do dono.

### Ambiente da suíte

- **Testcontainers por teste**. Dá controle fino por cenário, mas exige que os passos construam e subam cada serviço, e o compose já é o que o CI precisa para o deploy de teste. Descartado para não duplicar a orquestração.
- **Ambiente de HML**. Teste de verdade, mas depende de cluster, credenciais e rede privada. Descartado: falha de infraestrutura bloquearia o merge na véspera da entrega.
- **Mercado Pago real (conta de teste)**. A ADR-0022 registra que o Mercado Pago não tem mais sandbox e que a conta de teste usa a API de produção. Um teste de fluxo com a API real fica dependente de rede e de terceiro, e o status devolvido não é controlável. Fica para a demonstração ([#341](https://github.com/Async-And-Furious/async-furious-project/issues/341)).

## Consequências positivas

- O fluxo da saga passa a ser um artefato executável, em Gherkin, que o avaliador lê sem abrir o código.
- Um único runner e uma única configuração de CI para o OS Service.
- Uma regressão em qualquer um dos três serviços quebra o build do OS Service.
- Os cenários servem de roteiro para a demonstração em vídeo (#341).

## Consequências negativas

- O dialeto `pt` depende de a versão fixada do `jest-cucumber` manter esse dialeto. A versão 4.5.0 foi verificada (Decisão, seção 1); trocar a versão exige repetir o parse.
- O OS Service passa a depender da imagem dos outros dois serviços no CI (item 1 de [Em aberto](#em-aberto)).
- O compose sobe cinco componentes além dos serviços, e o job de BDD é mais lento que a suíte unitária.
- A suíte não mede cobertura. Quem olhar só o número de cobertura não vê o fluxo testado; o README do serviço precisa dizer isso.

## Riscos

- **Flaky por Kafka.** O broker em compose demora mais que um broker AMQP para ficar pronto. Mitigação: `healthcheck`, criação de tópicos com saída de erro, e asserções com prazo (seção 3). Sem essas três, o risco é alto.
- **Divergência entre `mongo` e DocumentDB.** O teste usa só operadores comuns aos dois. Um operador que funciona no `mongo` e falha no DocumentDB passa no CI e só aparece no HML.
- **Stub do Mercado Pago diverge da API real.** Um campo que o stub não devolve pode esconder um erro de contrato. Mitigação: o stub só responde os endpoints que o Billing usa (ADR-0022), e a validação real fica na demonstração (#341).
- **Imagens dos outros serviços.** Se o Billing ou a Execução publicarem imagem quebrada, o job do OS Service quebra por motivo que não é dele. Mitigação: fixar a tag ou o SHA (item 1).
- **Cenário de falha bloqueado pela #338.** Até as compensações existirem, o segundo cenário falha. Ele deve ficar fora do job obrigatório até a #338 ser mesclada, ou o job deve ficar vermelho. Decisão do grupo (item 5).

## Em aberto

Decisões do grupo. Esta ADR não as fecha.

1. **Origem das imagens do Billing e da Execução no compose.** Opções: (a) imagem do ECR, com tag pelo SHA do `develop` de cada repositório; (b) build no próprio job, com checkout dos dois repositórios (exige token de leitura cross-repo). Recomendação desta ADR: (a), por determinismo e menos tempo de CI.
2. **Verificação: URL base do Mercado Pago configurável no Billing.** Não é uma escolha, é um fato a confirmar no repositório do Billing antes de escrever os passos. O stub só intercepta se o Billing aceitar a URL base por variável de ambiente. Se a variável não existir, o pedido vai para o épico do Billing (#322).
3. **Leitura de estado e de eventos nos passos.** Os passos afirmam estados e eventos que os documentos fixam, mas nem todos têm rota de leitura documentada. Rotas já existentes ou documentadas: estado da OS por `GET /api/v1/ordens-servico/{id}/status` (público, no OS Service, devolve `status`); `Pagamento` por `GET /api/v1/pagamentos/{ordemServicoId}` (ADR-0022, item 11, papéis `ADMIN` e `RECEPCIONISTA`); estado da `Execucao` pela listagem `GET /api/v1/execucoes?status=...` (PR #2 do `repo-execucao-service`, ainda não mesclado; a suíte acha a `Execucao` pelo `ordemServicoId`). Sem rota documentada: estado do `Orcamento`, reserva de peças, `pago_em` e `HistoricoStatusOS.motivo`. Os eventos são observados por um consumidor de teste nos tópicos, não por log. Decidir: (a) criar rota de leitura, e em qual épico; ou (b) a suíte ler o banco do serviço com a própria credencial (ADR-0020). Até lá, os passos desses itens dependem de detalhe interno. O `.feature` usa só o que os documentos fixam.
4. **Terminologia do Mercado Pago.** A ADR-0022 (Contexto) diz que o Mercado Pago não tem mais sandbox. Ainda usam o termo: o [`saga-flow.md`](../architecture/saga-flow.md) §3 ("recusar o pagamento no sandbox"), a [ADR-0016](./0016-saga-coreografada.md) (Riscos: "modo sandbox para o cenário de estorno real") e a própria [ADR-0022](./0022-integracao-mercado-pago-checkout-pro.md) (Fallback e Em aberto, "no sandbox"), além da issue #340 ("sandbox real", na demonstração). Alinhar em todos ou só nos que o grupo escolher. Esta ADR usa "stub" para o teste e "conta de teste" para a demonstração. A correção de ADR-0022 e ADR-0016 não está no escopo desta entrega.
5. **Cenário de falha no job obrigatório.** Enquanto a #338 não for mesclada, o cenário de compensação falha. Escolher: (a) job vermelho até a #338; (b) cenário marcado para ser pulado por tag até a #338 (a remover quando ela entrar). Recomendação desta ADR: (b), para não bloquear merges de outros épicos, com a tag removida na mesma PR da #338.

## Referências

- Issue [#340](https://github.com/Async-And-Furious/async-furious-project/issues/340) — Testar o Fluxo Completo com BDD
- Issue [#338](https://github.com/Async-And-Furious/async-furious-project/issues/338) — Compensações e Rollback
- Epic [#336](https://github.com/Async-And-Furious/async-furious-project/issues/336) — Saga do Fluxo de OS
- Enunciado da Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.4, p.5 e p.6
- [`saga-flow.md`](../architecture/saga-flow.md) — §1 sequência, §3 matriz de falhas
- [`event-catalog.md`](../architecture/event-catalog.md) — eventos e assinaturas por serviço
- [ADR-0014 — Cobertura mínima de testes](./0014-cobertura-minima-testes.md)
- [ADR-0016 — Saga coreografada](./0016-saga-coreografada.md)
- [ADR-0018 — Kafka, envelope, tópicos e retry/DLT](./0018-mensageria-contratos-eventos.md)
- [ADR-0019 — DocumentDB como read model](./0019-documentdb-read-model-os-cliente.md)
- [ADR-0020 — Bancos compartilhados com isolamento por credencial](./0020-bancos-compartilhados-isolamento-credencial.md)
- [ADR-0021 — Borda sem BFF](./0021-borda-sem-bff.md)
- [ADR-0022 — Integração com o Mercado Pago](./0022-integracao-mercado-pago-checkout-pro.md)
- [`test/bdd/features/fluxo-saga-os.feature`](../../test/bdd/features/fluxo-saga-os.feature) — os dois cenários
- [`test/bdd/README.md`](../../test/bdd/README.md) — o que existe e o que falta
