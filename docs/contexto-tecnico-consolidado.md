# Contexto Técnico Consolidado — Async & Furious (Sistema de Gestão para Oficina Mecânica)

> **Natureza deste documento**: memória técnica consolidada, construída a partir da leitura integral de todos os arquivos em `docs/` (incluindo subpastas) e de arquivos de raiz diretamente referenciados por eles (`README.md`, `AGENTS.md`, `CHANGELOG.md`). Não é um resumo por arquivo — é uma síntese cruzada, com eliminação de redundância e sinalização explícita de conflitos e lacunas. Escrito para ser consumido por outra IA como contexto de partida, sem necessidade de reler a documentação original.
>
> **Fontes analisadas**: `docs/ddd.md`, `docs/context-map/suggestions/*` (mmd, png, jpg, pdf), `docs/domain-storytelling/suggestions/*` (egn, png), `docs/egon.io/*.egn` (5 cenários), `docs/event-storming/suggestions/*` (mmd, png), `docs/others/suggestions/*` (domain-model e os-flow, mmd/png), `docs/http/insomnia.yaml`, `docs/http/ciclo-completo-os.http`, `docs/reports/relatorio-e2e-orcamento-curl.md`, `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`, `docs/static/*.png`. Complementarmente: `README.md`/`README-en.md` (fonte de verdade operacional/rotas) e `AGENTS.md` (fonte de verdade de convenções e schema).

---

## 1. Visão Geral

O **Async & Furious** é o backend de um **sistema de gestão integrada para oficina mecânica**, desenvolvido como Tech Challenge da pós-graduação em Arquitetura de Software (turma **15SOAT, FIAP**). Resolve um problema concreto de digitalização de processos manuais de oficinas: hoje geridos por planilhas e comunicação informal, o sistema centraliza o cadastro de clientes e veículos, o ciclo de vida completo de uma Ordem de Serviço (OS) — do recebimento à entrega —, o controle de estoque de peças/insumos (incluindo reposição junto a fornecedores) e o registro financeiro de pagamentos.

A "linguagem ubíqua" documentada em `docs/ddd.md` usa termos em português para as entidades de negócio (Cliente, Veículo, Ordem de Serviço, Orçamento, Peça/Insumo) mesmo com o código majoritariamente em inglês estrutural (nomes de classes técnicas), refletindo uma decisão consciente de aproximar o modelo do vocabulário do domínio real (mecânica automotiva brasileira).

### Evolução entre fases

A documentação não contém um relato formal e explícito "Fase 1 → Fase 2 → Fase 3" dentro de `docs/`, mas a evolução pode ser reconstruída cruzando `docs/` com `CHANGELOG.md`, histórico de commits e o próprio README:

- **Fase 1 (implícita)** — Escopo inicial de CRUD e regras básicas: scaffold do projeto NestJS (`ANF-01`), estruturação em Clean Architecture para o módulo `Cliente` com nomenclatura em português (`ANF-03`), e o início da modelagem de domínio colaborativa (Domain Storytelling) registrada em `ANF-02`. É a fase de fundação: entidades, validações (CPF/CNPJ, placa), autenticação JWT.
- **Fase 2** — Consolidação do ciclo completo da Ordem de Serviço (estados, orçamento, aprovação/recusa pelo cliente, papéis `ADMIN`/`RECEPCIONISTA`/`MECANICO`), marcada explicitamente por um commit "Updated README.md with new changes for phase 2". É quando o domínio de OS, orçamento e estoque amadurece para o fluxo ponta a ponta hoje documentado no README e nos relatórios E2E.
- **Fase 3 (atual)** — Foco em **escalabilidade e automação de infraestrutura**: é o assunto explícito e datado (2026-06-22) do documento `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`, que especifica provisionamento via Terraform + Kubernetes (kind local, com trilha de migração para EKS), HPA, CI/CD com `terraform validate`/`plan` em PRs e `apply` real em push para `main`/`develop`. O README reflete essa fase com uma seção dedicada de arquitetura de infraestrutura e diagrama Mermaid do cluster.

**Lacuna identificada**: não há em `docs/` nenhum documento que rotule explicitamente marcos como "Fase 1", "Fase 2" ou "Fase 3" com escopo formal e datas de entrega — a divisão acima é inferida por correlação de commits, datas de arquivos e conteúdo temático, não é uma fonte única e autoritativa.

---

## 2. Arquitetura

### Estilo arquitetural

O projeto adota **Clean Architecture combinada com Domain-Driven Design (DDD)**, conforme declarado no README e reforçado estruturalmente em `AGENTS.md`. A regra de dependência é estrita e unidirecional:

```
presentation → application → domain ← infrastructure
```

- **Domain**: zero dependências externas — não referencia `PrismaService`, `JwtService` ou qualquer biblioteca de framework. Contém entidades, value objects, interfaces de repositório e exceções de domínio.
- **Application**: depende exclusivamente do domain. Contém os *use cases*. Regra explícita em `AGENTS.md`: a camada de application **não pode importar classes concretas de infraestrutura** — deve depender de contratos/tokens do domínio para repositórios e publicadores de eventos. Listeners de eventos ficam na infraestrutura, para manter as políticas de aplicação livres de framework.
- **Infrastructure**: implementa as interfaces de domínio (repositórios Prisma, publicador de eventos, filtros).
- **Presentation**: controllers HTTP, DTOs validados com `class-validator`, depende apenas de application.

### Organização por módulos (Bounded Contexts como módulos de código)

`src/modules/` contém 4 módulos de domínio, cada um replicando a mesma estrutura em camadas internamente:

| Módulo | Caminho | Responsabilidade | Entidades principais |
|---|---|---|---|
| `cadastro` | `src/modules/cadastro/` | Cadastro e manutenção de Clientes, Veículos e catálogo de Serviços | Cliente, Veiculo, Servico |
| `ordem-servico` | `src/modules/ordem-servico/` | Ciclo de vida da OS e Orçamento associado | OrdemServico, Orcamento |
| `pecas-insumos` | `src/modules/pecas-insumos/` | Estoque de peças/insumos e pedidos a fornecedor | Peca |
| `financeiro` | `src/modules/financeiro/` (`auth` fica em `src/auth/` como módulo transversal) | Registro de pagamentos e disparo da entrega da OS | Pagamento (implícito — ver lacuna na seção 3) |

`src/shared/` concentra o que é transversal: `domain/exceptions` (exceções de domínio comuns), `infrastructure/database` (PrismaModule/PrismaService), `infrastructure/filters` (GlobalExceptionFilter) e uma base de `DomainEvent`.

**Nota de nomenclatura**: os nomes de módulos e pastas em código (`cadastro`, `ordem-servico`, `pecas-insumos`, `financeiro`) não coincidem literalmente com os nomes dos Bounded Contexts descritos em `docs/ddd.md` ("Clientes e Veículos", "Ordem de Serviço", "Estoque e Serviços", "Financeiro", "Segurança e Autenticação") — o próprio `ddd.md` reconhece essa correspondência ao dizer que os eventos "estão organizados por BC, refletindo a estrutura de módulos definida em `src/modules/`", mas o BC "Estoque e Serviços" do texto conceitual corresponde ao módulo de código `pecas-insumos` mais o catálogo de `Servico` dentro de `cadastro` — ou seja, um único BC conceitual está fisicamente dividido em dois módulos de código diferentes. Isso é uma tensão real entre o modelo conceitual e a implementação, não necessariamente um erro, mas vale registrar.

### Princípios e decisões de padrão

- **Interfaces de repositório vivem no domínio; infraestrutura implementa** (Dependency Inversion clássico de Clean Architecture).
- **DTOs de entrada validados globalmente** via `ValidationPipe` com `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` (definido em `main.ts`, documentado em `AGENTS.md`) — qualquer campo não esperado no payload é rejeitado, e tipos são coagidos automaticamente.
- **Nunca usar `as any` ou `@ts-ignore`** — regra crítica explícita, indicando preocupação forte com type-safety mesmo com `noImplicitAny: false` (modo legado) ativo no `tsconfig.json`.
- **Testes preferencialmente em `test/`, não em `src/`** — convenção de organização que separa código de produção de testes.
- **Emissão de eventos de domínio**: existe uma base `DomainEvent` em `shared/domain` e um `EmissorEventos` em `shared/infrastructure` — arquitetura orientada a eventos internos (não um barramento externo), coerente com o Event Storming documentado (ver seção 3).

### ADRs / RFCs

Não existe uma pasta formal de ADRs (Architecture Decision Records) numerados no padrão clássico (`docs/adr/0001-...`). O único documento com formato equivalente a uma RFC/ADR é:

- **`docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`** — status "Approved", decisão registrada em formato tabular (Decisão | Escolha | Motivo). Cobre 5 decisões centrais de infraestrutura:
  1. **kind** como Kubernetes local (roda em Docker, zero pré-requisitos extras, compatível com CI).
  2. **Terraform state local** (`.tfstate`) — justificado por ser projeto acadêmico, sem necessidade de backend remoto.
  3. **CI/CD só valida e planeja** (`terraform validate` + `plan`), nunca aplica automaticamente — humanos rodam `apply`. *(Nota: este documento antecede a implementação final documentada no README, que descreve um segundo job de CI que efetivamente aplica a infraestrutura em push para `main`/`develop` dentro de um cluster kind efêmero no runner — ver conflito detalhado na seção 8.)*
  4. **Estrutura Terraform modular** (opção "B" entre alternativas consideradas) — YAML do Kubernetes reutilizável fora do Terraform; migração para EKS vira apenas um novo diretório de ambiente.
  5. **Manifests Kubernetes em YAML puro** em `/k8s` (não Helm/Kustomize) — escolhido por legibilidade e compatibilidade direta com `kubectl` para debugging.

  O documento também mapeia explicitamente critérios de aceitação (provavelmente de um requisito do Tech Challenge) para artefatos concretos do repositório — evidência de que a Fase 3 tinha uma checklist formal de entrega.

### Responsabilidades dos "repositórios" (no sentido de padrão Repository, não repositório Git)

Cada módulo define interfaces de repositório no domínio (ex.: `IClienteRepository`) e implementações concretas em `infrastructure/repositories/` usando Prisma. O padrão de teste documentado em `AGENTS.md` mostra que os use cases são testados via mock dessas interfaces (`jest.Mocked<IClienteRepository>`), confirmando que a inversão de dependência é ativamente respeitada e testável.

---

## 3. Modelo de Domínio

O modelo de domínio formal está inteiramente em `docs/ddd.md`, seção 4, complementado visualmente pelo diagrama de classes `docs/others/suggestions/domain-model.suggestion.vic.mmd`.

### Bounded Contexts (5, conforme `ddd.md` §3)

1. **Ordem de Serviço (OS)** — criação, acompanhamento e ciclo de vida da OS, incluindo geração/aprovação de orçamento (o orçamento é tratado como parte deste contexto, não como contexto financeiro).
2. **Clientes e Veículos** — cadastro e manutenção de clientes e seus veículos.
3. **Estoque e Serviços** — catálogo de serviços oferecidos, estoque de peças/insumos, precificação.
4. **Financeiro** — módulo `financeiro`, registra pagamentos e integra-se ao ciclo de entrega da OS. O próprio `ddd.md` admite que esse contexto existe "no estado atual do projeto" como módulo técnico, sugerindo que foi formalizado depois dos outros quatro.
5. **Segurança e Autenticação** — autenticação de usuários administrativos e validação de dados sensíveis.

### Agregados, Entidades e Value Objects por contexto

**Gestão de Ordem de Serviço**
- Agregado raiz: **OrdemDeServico**, contendo as entidades internas **ItemServico** e **ItemPeca**, e os Value Objects **StatusOS** (enum de 8 estados — ver seção 4) e **Orcamento** (valor total de serviços, valor total de peças, valor total geral, flag de aprovação).

**Gestão de Clientes e Veículos**
- Agregado raiz: **Cliente** (nome/razão social, VO **CPFCNPJ** com validação e tipo, VO **Endereco**), contendo a entidade **Veiculo** (placa, marca, modelo, ano) como parte do agregado.
- **Ponto de atenção**: o schema Prisma real (via `AGENTS.md`) modela `Cliente`→tabela `Customer` e `Veiculo`→tabela `Vehicle` como registros independentes ligados por `id_cliente`, não como uma coleção embutida fisicamente — o "Veiculo como entidade dentro do agregado Cliente" é um conceito de modelagem DDD, não uma composição de armazenamento. Isso é esperado (agregado ≠ esquema físico), mas vale deixar explícito para não confundir modelo de domínio com modelo relacional.

**Gestão de Estoque e Serviços**
- Dois agregados independentes: **Peca** (nome, descrição, preço unitário, VO **QuantidadeEstoque** com ponto de reposição opcional) e **Servico** (nome, descrição, VO **PrecoServico**).

**Segurança e Autenticação**
- Agregado raiz: **UsuarioAdministrativo** (username, senha em hash, papel), com VO **Credenciais** (token JWT + expiração).
- **Divergência de nomenclatura de papéis**: `ddd.md` cita como exemplo de papéis "Administrador, Mecânico, Atendente", enquanto o README e o schema real usam os papéis efetivos `ADMIN`, `RECEPCIONISTA`, `MECANICO`. "Atendente" nunca aparece como papel implementado — é apenas um exemplo genérico dentro do texto de DDD, não uma terceira nomenclatura conflitante de fato, mas pode confundir por parecer um sinônimo não oficial de `RECEPCIONISTA`.

**Financeiro — lacuna identificada**: ao contrário dos outros 4 contextos, a seção 4 de `ddd.md` **não** define um agregado/entidade/VO formal para o contexto Financeiro (não há um bloco "4.5 Contexto: Gestão Financeira" com uma entidade `Pagamento` documentada estruturalmente, apesar de o contexto ser descrito em prosa na seção 3.4 e ter eventos de domínio próprios na seção 5). Este é o contexto com modelagem tática menos madura em toda a documentação.

### Eventos de Domínio e Comandos (Event Storming, `ddd.md` §5)

Os eventos estão organizados por Bounded Context de código (`src/modules/`), totalizando **29 eventos de domínio** documentados:

- **`ordem-servico` (9 eventos)**: `OrdemDeServicoRecebida`, `OrdemDeServicoEmDiagnostico`, `OrdemDeServicoAguardandoAprovacao`, `OrdemDeServicoEmExecucao`, `OrdemDeServicoFinalizada`, `OrdemDeServicoEntregue`, `OrcamentoGerado`, `OrcamentoAprovado`, `OrcamentoRejeitado`. Comandos correspondentes cobrem toda a máquina de estados da OS mais ações de consulta (`ConsultarProgressoOS`).
- **`cadastro` (9 eventos)**: cobre CRUD de Cliente e Veículo (`ClienteCadastrado/Atualizado/Removido`, `VeiculoCadastrado/Atualizado/Removido`) mais três eventos de **Domain Storytelling** que não são CRUD puro — `ClienteIdentificado`, `DadosClienteInformados`, `VeiculoAnalisado` — refletindo o momento de atendimento presencial (recepção) mais do que uma operação de API.
- **`pecas-insumos` (8 eventos)**: CRUD de peça mais eventos de estoque (`EstoqueAtualizado`, `PecaComEstoqueBaixo`, `ReposicaoEstoqueSolicitada`) e de uso em OS (`PecasListadasParaOS`, `PecaAdicionadaAOS`).
- **`financeiro` (3 eventos)**: `PagamentoRegistrado`, `PagamentoProcessado`, `NotaFiscalEmitida`.

**Gap relevante entre eventos documentados e rotas implementadas**: o evento `NotaFiscalEmitida` e o comando `EmitirNotaFiscal` não têm nenhuma rota correspondente na tabela de endpoints do README nem na coleção `insomnia.yaml` — não há emissão de nota fiscal implementada; é um evento aspiracional/documentado que ainda não foi construído. Da mesma forma, os eventos `OrdemDeServicoAguardandoAprovacao`/`OrcamentoRejeitado` cobrem bem os estados centrais, mas não há eventos nomeados explicitamente para os estados `AWAITING_PARTS` e `CLOSED_WITHOUT_EXECUTION` que aparecem no ciclo de vida do README (ver conflito detalhado na seção 8) — sugerindo que esses dois estados foram adicionados à state machine em um momento posterior ao Event Storming original e a documentação de eventos não foi atualizada.

### Casos de uso importantes (inferidos pela combinação de rotas + comandos documentados)

- Cadastro completo de Cliente/Veículo com validação de CPF/CNPJ e placa brasileira (Mercosul/antiga).
- Abertura de OS vinculando Cliente + Veículo.
- Diagnóstico do veículo pelo mecânico e geração de orçamento (serviços + peças).
- Aprovação/recusa do orçamento pelo cliente (rota pública, sem autenticação — o cliente final não é um usuário do sistema).
- Execução dos serviços, finalização e registro de entrega.
- Controle de estoque com ponto de reposição mínimo e fluxo de solicitação/recebimento de peças de fornecedor.
- Registro de pagamento, que dispara automaticamente a entrega da OS.
- Consulta de tempo médio de execução de OS (indicador operacional para ADMIN).

---

## 4. Fluxos do Sistema

### Fluxo principal: Abertura e acompanhamento da OS

Documentado de forma consistente em três artefatos independentes — o Domain Storytelling (`docs/domain-storytelling/suggestions/domain-storytelling.suggestion.vic.png`/`.egn`), o diagrama de sequência (`docs/others/suggestions/os-flow.suggestion.vic.mmd`) e o relatório E2E real via cURL (`docs/reports/relatorio-e2e-orcamento-curl.md`) — todos narrando essencialmente a mesma história, com pequenas diferenças de granularidade:

1. O **Cliente** informa seus dados e a necessidade de serviço ao **Recepcionista** (presencialmente, fora do sistema).
2. O Recepcionista cadastra Cliente e Veículo no sistema.
3. O Recepcionista cria a Ordem de Serviço, que nasce no estado `RECEIVED`.
4. O Recepcionista atribui/o Mecânico assume a OS (`PATCH /assumir`) → estado muda para `UNDER_DIAGNOSIS`.
5. O Mecânico registra o diagnóstico do veículo (`PATCH /analisar`) — estado permanece `UNDER_DIAGNOSIS`.
6. O Mecânico lista os serviços e peças necessários e gera o orçamento (`PATCH /servicos-insumos`, exige `valor_total_servicos > 0`) → estado muda para `AWAITING_APPROVAL`.
7. O sistema envia o orçamento para aprovação do cliente (fora do sistema — e-mail/telefone, não modelado como integração no código).
8. O **Cliente** aprova (`PATCH /orcamento/aprovar`, rota pública, sem token) ou recusa (`PATCH /orcamento/recusar`) o orçamento.
   - Se aprovado → estado muda para `IN_PROGRESS`, e o timestamp `iniciada_em` é preenchido automaticamente.
   - Se recusado → segundo o README, a OS pode ir para `CLOSED_WITHOUT_EXECUTION` (ver observação de conflito na seção 8, pois esse estado não está listado no enum documentado em `AGENTS.md`).
9. O Mecânico executa os serviços; se faltarem peças, a OS pode transitar para `AWAITING_PARTS` e retornar a `IN_PROGRESS` quando as peças forem reservadas (fluxo descrito apenas no diagrama textual de ciclo de vida do README, não detalhado em Domain Storytelling).
10. O Mecânico finaliza a execução (`PATCH /finalizar-execucao`) → estado `FINISHED`, `finalizada_em` preenchido automaticamente.
11. O Cliente pode aprovar o serviço prestado (`PATCH /aprovar-servico`, também pública).
12. O Recepcionista registra a entrega (`PATCH /registrar-entrega`) → estado `DELIVERED`, `entregue_em` preenchido automaticamente.
13. O ADMIN pode consultar o tempo médio de execução de todas as OS finalizadas/entregues (`GET /ordens-servico/tempo-medio`).

O relatório E2E (`relatorio-e2e-orcamento-curl.md`) confirma esse fluxo rodando de verdade contra a API (registro de usuário → login → criação de cliente/veículo/OS → geração de orçamento → aprovação → estado final `IN_PROGRESS`), e deixa uma nota importante: **a geração de orçamento é acionada pelo endpoint `PATCH /ordens-servico/:id/servicos-insumos`**, não por um endpoint dedicado "gerar orçamento" — é a mesma chamada que registra os itens de serviço/peça que dispara o cálculo e a mudança de status.

### Fluxo: Aprovação de orçamento

Subfluxo do anterior, mas vale destacar como fluxo próprio porque é o único ponto de interação do **Cliente final diretamente com a API sem autenticação** (rotas `@Public()`). É o "gate" financeiro do processo: nenhuma execução de serviço ocorre sem essa aprovação explícita.

### Fluxo: Gestão de estoque e peças

Documentado no Event Storming (`docs/event-storming/suggestions/vic.event_storming.mmd`/`.png`) como dois sub-fluxos paralelos dentro do mesmo Bounded Context:
- **Ciclo de vida do cadastro de peça**: `CadastrarPeca → PecaCadastrada → AtualizarPeca → PecaAtualizada → RemoverPeca → PecaRemovida`.
- **Ciclo de controle de estoque**: `AtualizarEstoquePeca → EstoqueAtualizado → PecaComEstoqueBaixo` (o evento de estoque baixo é uma consequência condicional da atualização, não uma ação direta).

Esse segundo sub-fluxo se conecta ao fluxo de reposição documentado apenas na coleção `insomnia.yaml` (não há menção explícita em `ddd.md`): **Solicitar Peças ao Fornecedor** (`POST /pecas/fornecedor/solicitar`) e **Receber Peças do Fornecedor** (`PATCH /pecas/fornecedor/pedidos/:pedidoId/receber`), ambos marcados com códigos de requisito `P-22` e `P-23` — indício de que essas rotas atendem itens numerados de um backlog/especificação de requisitos externa ao repositório (não encontrada em `docs/`).

Os cenários complementares de Domain Storytelling em `docs/egon.io/` (renderizados como PNG em `docs/static/`) cobrem, em formato simplificado (ator → verbo → objeto, sem numeração de sequência complexa):
- **Cadastro de peça**: Adm cadastra Peças/Insumos.
- **Remoção de peça**: Mecânico lista Peças/Insumos → Cliente aprova Orçamento → Mecânico remove a Peça (fluxo que sugere que a remoção de uma peça do estoque, no contexto de uma OS, só acontece depois de orçamento aprovado — coerente com o fluxo principal).
- **Cadastro de serviço**: Adm cadastra um Serviço na lista de Serviços.
- **Consulta de OS**: Cliente consulta a Ordem de Serviço diretamente (cenário mínimo, 1 passo).
- **Notificação de orçamento**: Mecânico finaliza o Orçamento → Sistema notifica a Proposta ao Cliente → Cliente avalia a Proposta — este é o mesmo "gate" de aprovação descrito acima, modelado como história separada focada na notificação.

### Fluxo: Financeiro / Pagamento

O único endpoint documentado é `POST /pagamentos/registrar`, descrito no README como "Registrar pagamento e disparar entrega da OS". Isso indica um acoplamento direto: o registro do pagamento não é apenas contábil, ele **automaticamente aciona a transição da OS para entregue** (ou serve de gatilho complementar ao `registrar-entrega`). A documentação não detalha a regra de negócio exata (se o pagamento é pré-requisito para `registrar-entrega` ou se ele mesmo dispara a transição) — **lacuna**: não há Domain Storytelling, Event Storming visual ou diagrama de sequência dedicado ao fluxo financeiro, ao contrário de todos os outros contextos.

### Fluxo: Autenticação

Não modelado visualmente em nenhum diagrama de `docs/`. Reconstruído a partir de README + AGENTS.md: login (`POST /auth/login`, público) retorna um JWT válido por 1 hora; registro de novo usuário (`POST /auth/register`) é restrito a `ADMIN`. Os testes manuais em `docs/http/ciclo-completo-os.http` mostram que o seed do banco já cria usuários `admin@oficina.com`, `recepcionista@oficina.com` e `mecanico@oficina.com` com senhas fixas de desenvolvimento, permitindo obter tokens dos três papéis sem precisar registrar manualmente.

---

## 5. Diagramas

### 5.1 Context Map — versão "vic" (canônica, referenciada por `ddd.md`)
**Arquivo**: `docs/context-map/suggestions/context-map.suggestion.vic.mmd` (+ `.png`)
**Objetivo**: mostrar as relações de integração entre os Bounded Contexts.
**Componentes**: 4 subgrafos — "Contexto de Atendimento" (Cliente, Veículo), "Contexto de Operação" (OS, Orçamento), "Contexto de Inventário" (Peças/Insumos, Serviços) e "Contexto de Segurança" (Autenticação JWT).
**Interações/decisões**: Cliente e Veículo se relacionam com OS via **Shared Kernel** (não upstream/downstream — o núcleo de dados do cliente/veículo é compartilhado diretamente pela OS). Orçamento e OS têm uma relação **Upstream/Downstream bidirecional** anotada nas duas direções (o que é conceitualmente estranho — normalmente upstream/downstream é direcional; provavelmente representa que a relação varia dependendo do fluxo: geração de orçamento é OS→Orçamento upstream, mas aprovação de orçamento retroalimenta o status da OS). Peças e Serviços são **Upstream** em relação à OS (a OS consome desses catálogos, não o contrário). Autenticação se relaciona com OS via **ACL (Anti-Corruption Layer)** — decisão importante: o contexto de segurança é isolado do domínio de negócio por uma camada de tradução, evitando que conceitos de autenticação vazem para dentro do domínio de OS.

### 5.2 Context Map — versão "trigo" (alternativa não adotada)
**Arquivos**: `docs/context-map/suggestions/context-map.suggestion.trigo.jpg` e `.pdf`.
**Objetivo**: proposta concorrente de Context Map, produzida por outro integrante da equipe durante a modelagem colaborativa.
**Divergência estrutural relevante**: nesta versão, **Veículo** é alocado dentro do **Contexto de Operação** (junto com Ordem de Serviço e Orçamento), e não dentro de um contexto de Atendimento/Cliente como na versão "vic". Além disso, "Peças" e "Serviços" aparecem como **dois contextos separados** ("Contexto de Inventário" e "Contexto de Serviços"), enquanto a versão vic os agrupa em um único "Contexto de Inventário". As relações são anotadas de forma mais uniforme como "UPSTREAM/DOWNSTREAM" bidirecional para quase todas as ligações, e a autenticação (rotulada "JWT") também usa **ACL** — neste ponto os dois modelos concordam.
**Resolução da divergência**: o texto descritivo oficial em `ddd.md` §3 define "Contexto: Clientes e Veículos" como um único BC — isso alinha com a versão **vic**, não com a "trigo". Portanto, a versão vic é a que efetivamente venceu como modelo adotado, embora nenhum documento diga isso explicitamente ("trigo" e "vic" parecem ser nomes de pessoas/apelidos dos autores das propostas, e a ausência de qualquer nota de decisão entre as duas é uma lacuna de rastreabilidade).

### 5.3 Diagrama de Modelo de Domínio (Tactical Design)
**Arquivo**: `docs/others/suggestions/domain-model.suggestion.vic.mmd` (+ `.png`), referenciado por `ddd.md` §6.2.
**Objetivo**: diagrama de classes UML-like detalhando atributos e métodos das entidades centrais.
**Componentes principais**: `OrdemDeServico` (com métodos de negócio explícitos: `Criar()`, `AdicionarServico()`, `AdicionarPeca()`, `GerarOrcamento()`, `Aprovar()`, `Finalizar()` — evidenciando que a entidade é modelada como rica em comportamento, não um DTO anêmico), `ItemServico`, `ItemPeca`, `Cliente`, `Veiculo`, `Peca`, `Servico`.
**Relações**: composição (`*--`) de `OrdemDeServico` com `ItemServico` e `ItemPeca` (ciclo de vida atrelado ao agregado); associações simples (`-->`) de `OrdemDeServico` para `Cliente` e `Veiculo` (referência, não composição — reforça que Cliente/Veículo são agregados independentes); `ItemServico`/`ItemPeca` referenciam `Servico`/`Peca` do catálogo.
**Observação**: os métodos de negócio no diagrama (`Aprovar()`, `Finalizar()`) não têm um método explícito para os estados `AWAITING_PARTS`/`CLOSED_WITHOUT_EXECUTION` — mais um indício (junto com a seção 3/8) de que esses dois estados foram incorporados depois da modelagem tática original.

### 5.4 Domain Storytelling: Fluxo de Criação e Acompanhamento da OS
**Arquivo**: `docs/domain-storytelling/suggestions/domain-storytelling.suggestion.vic.png` (fonte JSON: `.vic.egn`), referenciado por `ddd.md` §6.3.
**Objetivo**: narrar visualmente, em notação Domain Storytelling (ícones de ator/objeto de trabalho conectados por setas numeradas), a jornada completa da OS.
**Principais interações numeradas**: Cliente informa dados (1) → Recepcionista cadastra Veículo (2) e cria a OS (3) → Mecânico assume a OS (4) → Mecânico analisa o Veículo (5, mesma seta numerada aponta também para "Lista" Serviços e Peças/Insumos, ou seja, o passo 5 cobre diagnóstico + levantamento de itens) → Mecânico cria o Orçamento (6) → Sistema/Mecânico envia a Proposta ao Cliente (7) → Cliente avalia a Proposta (8).
**Decisão importante implícita**: o "Sistema" não aparece como ator explícito nesta história (diferente do diagrama de sequência §5.6) — a narrativa é centrada nos atores humanos (Cliente, Recepcionista, Mecânico) interagindo com objetos de trabalho (Dados, Veículo, OS, Serviços, Peças/Insumos, Orçamento, Proposta), estilo mais próximo do Domain Storytelling "puro" (que evita representar o sistema como ator).

### 5.5 Event Storming: Gestão de Peças e Insumos
**Arquivo**: `docs/event-storming/suggestions/event-storming.suggestion.vic.png`/`.mmd`, referenciado por `ddd.md` §6.4.
**Objetivo**: visualizar comandos (retângulos) e eventos (losangos) do sub-domínio de estoque.
**Componentes**: dois trilhos paralelos e independentes — (1) ciclo CRUD completo de peça (Cadastrar → Cadastrada → Atualizar → Atualizada → Remover → Removida) e (2) ciclo de estoque (Atualizar Estoque → Estoque Atualizado → **Peça Com Estoque Baixo**, este último um evento derivado/condicional, não uma ação direta de comando).
**Decisão importante**: o evento `PecaComEstoqueBaixo` não tem um comando que o preceda diretamente no diagrama — ele é uma consequência do sistema reagindo ao `EstoqueAtualizado`, sugerindo uma política de domínio reativa (guarda de "estoque abaixo do mínimo") em vez de uma ação explícita do usuário.

### 5.6 Sequência do fluxo de OS (versão alternativa)
**Arquivo**: `docs/others/suggestions/os-flow.suggestion.vic.mmd`/`.png`.
**Objetivo**: mesma jornada da seção 5.4, mas em notação de diagrama de sequência UML, com "Sistema" tratado como um ator/participante explícito.
**Diferença de granularidade em relação ao Domain Storytelling**: aqui aparecem explicitamente as respostas do sistema (ex.: "OS Criada (ID: #OS123)", "Diagnóstico Registrado", mensagens de retorno tracejadas), o auto-loop "Gera Orçamento" do Sistema sobre si mesmo, e passos pós-aprovação que o Domain Storytelling não cobre: início da execução, atualização de status para "Em Execução", finalização com registro de peças utilizadas, consulta de status pelo cliente, retirada do veículo e confirmação de entrega. **Este diagrama é o mais completo entre todos os artefatos visuais** — cobre a jornada inteira até a entrega, enquanto o Domain Storytelling (5.4) para na avaliação da proposta pelo cliente.

### 5.7 Cenários complementares de Domain Storytelling (egon.io, pasta `static/`)
Ver detalhamento narrativo na seção 4 ("Fluxos do Sistema" → gestão de estoque). São 5 diagramas simples (1 a 3 passos cada), cobrindo casos que não apareceriam no fluxo principal: consulta de OS isolada, notificação de orçamento como história própria, cadastro/remoção de peça, cadastro de serviço.

---

## 6. Banco de Dados

Não existe em `docs/` um diagrama entidade-relacionamento (ER) dedicado nem um documento de modelagem de banco de dados. O que existe é a tabela "Key Models" em `AGENTS.md`, que mapeia entidades de domínio para tabelas Prisma:

| Entidade de domínio | Tabela Prisma | Observação |
|---|---|---|
| `Cliente` | `Customer` | Campos `nome`, `documento`, `tipo_documento` |
| `Veiculo` | `Vehicle` | Campos `placa`, `marca`, `modelo`, `ano` |
| `OrdemServico` | `ServiceOrder` | Campos `id_veiculo`, `id_cliente` |
| `Orcamento` | `Estimate` | Relação 1:1 com OrdemServico |
| `Peca` | `Part` | — |
| `Servico` | `Service` | — |

**Decisão de modelagem explícita**: colunas em `snake_case` (`created_at`, `id_cliente`) mapeadas via `@map` do Prisma para manter a convenção de banco relacional tradicional, enquanto o código TypeScript permanece em camelCase/PascalCase — trade-off comum para não "vazar" a convenção do banco para a linguagem da aplicação.

**Enums documentados**: `TaxIdType` (`CPF`, `CNPJ`), `SOStatus` e `EstimateStatus` (`PENDING`, `APPROVED`, `REJECTED`). Ver conflito de `SOStatus` na seção 8 — o valor documentado em `AGENTS.md` diverge do ciclo de vida descrito no README e em `ddd.md`.

**Lacunas**: não há documentação sobre índices, constraints de unicidade (ex.: se `documento` do Cliente ou `placa` do Veículo têm unicidade garantida no schema), estratégia de soft-delete vs. hard-delete (as rotas `DELETE` existem para várias entidades, mas não há nota sobre exclusão lógica), nem sobre a tabela/entidade de Pagamento do módulo `financeiro` (não aparece na tabela de "Key Models", apesar de o módulo e a rota existirem).

---

## 7. Integrações

A documentação em `docs/` não descreve integrações com sistemas externos de terceiros (não há gateway de pagamento, serviço de notificação por e-mail/SMS, ou API de terceiros documentada). As "integrações" identificáveis são majoritariamente **internas** (entre módulos/bounded contexts do próprio sistema) ou de **infraestrutura**:

1. **Integração Ordem de Serviço ↔ Financeiro**: o registro de pagamento (`POST /pagamentos/registrar`) dispara a entrega da OS. É a única integração de negócio entre módulos além do consumo natural de catálogos (Peça/Serviço) pela OS.
2. **Integração OS ↔ Estoque de Peças**: ao gerar orçamento e utilizar peças em uma OS, o estoque é referenciado/afetado (eventos `PecasListadasParaOS`, `PecaAdicionadaAOS`). O detalhamento exato de reserva/baixa de estoque não está documentado em `docs/` (é uma lacuna — provável estar apenas no código).
3. **Integração com Fornecedor (modelada como fluxo interno, não como API externa real)**: `POST /pecas/fornecedor/solicitar` e `PATCH /pecas/fornecedor/pedidos/:pedidoId/receber`, catalogadas na coleção Insomnia com os códigos de requisito `P-22`/`P-23`. Não há evidência de que exista de fato uma chamada HTTP a um sistema de fornecedor externo — parece ser um registro manual de pedido/recebimento dentro do próprio sistema (simulação do processo de reposição).
4. **Terraform ↔ Kubernetes (kind)**: Terraform provisiona o cluster (`modules/kind-cluster`) e aplica todos os manifests (`modules/kubernetes-apps`) via provider `kubectl_manifest`. Valores sensíveis (`jwt_secret`, `db_password`) são injetados via `templatefile()`, nunca hardcoded.
5. **CI/CD (GitHub Actions) ↔ Terraform/Kubernetes**: workflow `terraform.yml` roda `validate`+`plan` em PRs que tocam `infra/**` ou `k8s/**`; em push para `main`/`develop` (ou `workflow_dispatch`), roda um job adicional que efetivamente builda a imagem, sobe um cluster kind efêmero, aplica a infraestrutura, faz smoke test em `/api/v1` e destrói tudo — usando o mesmo script `scripts/local-up.sh` do fluxo local.
6. **Trilha de migração documentada para AWS/EKS**: não é uma integração implementada, mas um caminho planejado — troca do provider Terraform, ECR para a imagem, `LoadBalancer`/Ingress no lugar de `NodePort`, backend S3 para state remoto. Documentado como stub em `infra/environments/aws/README.md` (fora de `docs/`, mas referenciado pelo spec de Terraform/K8s).

**Lacuna geral**: nenhuma integração de notificação real (e-mail/SMS/push) está documentada, apesar de o fluxo de negócio (Domain Storytelling "notificação de orçamento") descrever explicitamente que o "Sistema notifica a Proposta ao Cliente" — não há detalhe técnico de como essa notificação ocorre (provavelmente é apenas a resposta HTTP síncrona, não uma notificação assíncrona real).

---

## 8. Decisões Arquiteturais (consolidado)

| Decisão | Escolha | Motivo consolidado (via README, ddd.md, spec de Terraform/K8s) |
|---|---|---|
| Framework backend | **NestJS** | Arquitetura modular com injeção de dependência nativa, alinhada naturalmente à separação em camadas exigida por Clean Architecture/DDD. |
| Banco de dados | **PostgreSQL 15** | Consistência transacional — relevante para um domínio com fluxos financeiros (orçamento, pagamento) e de estoque que exigem integridade forte. |
| ORM | **Prisma 5.x** | Tipagem forte integrada ao TypeScript, reduzindo erros de mapeamento objeto-relacional; usado com camada de repositório própria no domínio (não se expõe diretamente aos use cases). |
| Autenticação | **JWT + bcrypt** (via `@nestjs/jwt` + `@nestjs/passport`) | Modelo stateless simples e padrão de mercado para APIs administrativas; papéis (`ADMIN`, `RECEPCIONISTA`, `MECANICO`) controlados via guards (`JwtAuthGuard`, `RolesGuard`); isolado do domínio de negócio por um Anti-Corruption Layer (ver Context Map, seção 5.1). Token expira em 1h. |
| Eventos internos | **EventEmitter / DomainEvent próprio** | Não há um message broker (Kafka/RabbitMQ/SQS) documentado — os eventos de domínio (`ddd.md` §5) são emitidos e tratados dentro do próprio processo via `EmissorEventos`, mantendo a arquitetura simples e adequada ao escopo acadêmico do projeto. |
| Orquestração | **Kubernetes (via kind localmente)** | Alta disponibilidade e escalabilidade horizontal automática (HPA 2–5 réplicas, CPU>70%/mem>80%) diante do crescimento de demanda e expansão para novas unidades da oficina (motivação de negócio explícita no README). |
| IaC | **Terraform** | Provisionamento reprodutível e versionado do cluster e dos recursos Kubernetes, com caminho de migração claro para EKS sem reescrever os manifests YAML (estrutura modular escolhida deliberadamente por isso). |
| Manifests Kubernetes | **YAML puro em `/k8s`** (não Helm/Kustomize) | Legibilidade e depuração direta via `kubectl`, decisão explícita registrada no spec de Terraform/K8s. |
| CI/CD | **GitHub Actions** | Valida build, roda testes automatizados e valida/planeja infraestrutura a cada PR; cobertura mínima de testes de 85% enforçada. |
| Segurança DAST | **OWASP ZAP** | Scan de segurança dinâmico incluído no pipeline (mencionado no README como parte da stack de tecnologia; há histórico de commits corrigindo falsos positivos/erros de configuração do ZAP). |

### Conflito documentado: CI/CD aplica ou não aplica infraestrutura automaticamente?

- `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md` (seção "CI/CD: `.github/workflows/terraform.yml`") afirma categoricamente: **"No `terraform apply` in CI. No cloud secrets needed for validate+plan."** — decisão original era puramente validação, sem nenhum `apply` automatizado.
- `README.md` (seção "CI/CD", mais recente) descreve um comportamento adicional: em push para `main`/`develop` (ou `workflow_dispatch`), o mesmo workflow **efetivamente aplica a infraestrutura de verdade** — builda a imagem, sobe um cluster kind efêmero, aplica com `terraform apply`, testa e destrói tudo com `terraform destroy` ao final, tudo dentro do runner do GitHub (sem conta de nuvem envolvida).
- **Conclusão**: não é uma contradição irreconciliável — o README documenta uma evolução posterior ao spec original (o `apply` acontece, mas contra um cluster efêmero e local ao runner, nunca contra infraestrutura de nuvem persistente, o que preserva o espírito original de "nenhum `apply` perigoso/irreversível em CI"). Ainda assim, é tecnicamente incorreto dizer hoje que "no terraform apply in CI" sem essa ressalva — o spec ficou desatualizado nesse ponto específico.

### Conflito documentado: enum de estados da Ordem de Serviço (`SOStatus`)

Três fontes descrevem o ciclo de vida da OS de forma diferente:

- **`AGENTS.md`** (schema Prisma, seção "Key Models") lista o enum `SOStatus` com **6 valores**: `RECEIVED`, `UNDER_DIAGNOSIS`, `AWAITING_APPROVAL`, `IN_PROGRESS`, `FINISHED`, `DELIVERED`.
- **`docs/ddd.md`** (linguagem ubíqua, §2, e Value Object `StatusOS`, §4.1) lista **8 valores**: os 6 acima **mais** `AWAITING_PARTS` (Aguardando Peças) e `CLOSED_WITHOUT_EXECUTION` (Encerrada Sem Execução).
- **`README.md`** (diagrama textual "Ciclo de Vida da Ordem de Serviço") também usa os **8 estados**, incluindo explicitamente as transições `AWAITING_APPROVAL → CLOSED_WITHOUT_EXECUTION` (quando o orçamento é recusado) e `IN_PROGRESS → AWAITING_PARTS → IN_PROGRESS` (quando faltam peças e depois são repostas).

**Como isso é sinalizado**: não há nota de nenhum dos três documentos reconhecendo a diferença. É possível que `AGENTS.md` esteja simplesmente desatualizado em relação ao schema Prisma real (o arquivo é uma referência operacional para agentes de IA, mais sujeita a ficar defasada que o próprio `schema.prisma`), mas como o objetivo aqui é reportar exatamente o que está documentado, este é um conflito real entre arquivos que uma IA consumindo este contexto deve verificar contra `prisma/schema.prisma` antes de assumir qualquer um dos dois como verdade absoluta.

### Por que Kubernetes/EKS e não apenas "mais VMs" ou serverless?

O README justifica a escolha por Kubernetes citando diretamente a necessidade de negócio: "com o aumento da demanda e a expansão para novas unidades, a oficina precisa garantir alta disponibilidade do sistema mesmo em picos de atendimento". Não há nenhuma menção em `docs/` a alternativas descartadas (ex.: por que não ECS/Fargate, por que não serverless) — a decisão aparece já tomada, sem um registro de trade-off comparativo. O template de épico (`'.github/ISSUE_TEMPLATE/nova-epic.md`, fora de `docs/` mas relevante para entender a direção do projeto) cita, como exemplos genéricos de impacto arquitetural, "Kubernetes, Terraform, AWS, API Gateway, Lambda" — isso **não é uma decisão tomada**, é apenas um exemplo ilustrativo dentro de um template de issue, mas sinaliza que a equipe já cogita, pelo menos como possibilidade de planejamento futuro, componentes serverless (API Gateway/Lambda) que hoje não existem na arquitetura documentada.

---

## 9. Pendências

Itens explicitamente identificados como futuros, incompletos ou não implementados, com a fonte de cada um:

1. **Migração para EKS**: caminho documentado passo a passo em `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md` ("EKS Migration Path"), mas apontado como **stub, não implementado** — `infra/environments/aws/README.md` é descrito literalmente como "stub — not implemented" na estrutura de diretórios do próprio spec.
2. **Emissão de Nota Fiscal**: evento `NotaFiscalEmitida` e comando `EmitirNotaFiscal` documentados em `ddd.md` §5.4 (Event Storming do contexto Financeiro), sem rota de API correspondente em nenhuma fonte (`README.md`, `insomnia.yaml`). Funcionalidade modelada mas não construída.
3. **Modelagem tática formal do contexto Financeiro**: como registrado na seção 3, falta em `ddd.md` uma seção de agregados/entidades/VOs para o Pagamento, equivalente ao detalhamento dado aos outros 4 contextos — é uma pendência de documentação, não necessariamente de implementação (a rota `POST /pagamentos/registrar` existe e funciona).
4. **Estados `AWAITING_PARTS`/`CLOSED_WITHOUT_EXECUTION`**: conforme seção 8, esses dois estados aparecem em `ddd.md` e `README.md`, mas não têm eventos de domínio nomeados no Event Storming (`ddd.md` §5.1 não lista `OrdemDeServicoAguardandoPecas` ou equivalente) nem métodos explícitos no diagrama de classes tático (seção 5.3) — a modelagem formal desses dois estados está pendente/incompleta em relação ao restante do ciclo de vida.
5. **Ambiente de produção real (fora do runner efêmero de CI)**: o README e o spec de Terraform/K8s cobrem apenas ambiente local (kind) e um cluster efêmero dentro do próprio pipeline de CI — não há evidência em `docs/` de um ambiente de produção real e persistente (EKS ou outro) já provisionado.
6. **Rastreabilidade de requisitos**: as rotas de fornecedor citam códigos `P-22`/`P-23` (seção 4/7), indicando a existência de uma lista de requisitos numerada que não está presente em `docs/` — não é possível, a partir da documentação atual, saber quantos requisitos existem no total nem o que cobrem os demais códigos.
7. **Decisão entre propostas concorrentes de modelagem (`trigo` vs. `vic`)**: como detalhado na seção 5.2, existem duas propostas de Context Map e (para Domain Storytelling) arquivos `.trigo.egn` e `.vic.egn` na mesma pasta de sugestões, sem nenhum registro formal de qual foi adotada ou por quê — a adoção da versão "vic" é inferida por consistência com o texto de `ddd.md`, não documentada como decisão.
8. **Planejamento de próximos épicos**: o template `.github/ISSUE_TEMPLATE/nova-epic.md` (adicionado/modificado recentemente conforme o estado atual do repositório) formaliza um processo de criação de épicos de arquitetura, mas nenhum épico concreto está presente em `docs/` — é evidência de intenção de planejamento mais formal daqui para frente, sem conteúdo substantivo ainda.

---

## 10. Contexto Consolidado

O Async & Furious é a API backend de um sistema de gestão de oficina mecânica construído como Tech Challenge de pós-graduação em Arquitetura de Software (turma 15SOAT, FIAP), usando NestJS + TypeScript + PostgreSQL + Prisma, estruturado deliberadamente segundo Clean Architecture combinada com Domain-Driven Design. A motivação de negócio é substituir processos manuais de oficina (planilhas, comunicação informal) por um sistema único capaz de rastrear em tempo real o ciclo de vida de uma Ordem de Serviço, controlar estoque de peças com reposição junto a fornecedores, e validar dados de domínio brasileiros (CPF/CNPJ, placas veiculares). O projeto evoluiu em pelo menos três momentos reconhecíveis pela documentação e histórico: uma fase fundacional de scaffold e modelagem colaborativa inicial (Domain Storytelling, Event Storming, Context Map, todos produzidos por pelo menos dois colaboradores em paralelo, com propostas identificadas informalmente como "trigo" e "vic"); uma fase de maturação do fluxo ponta-a-ponta da Ordem de Serviço e orçamento (papéis de usuário, aprovação do cliente, geração automática de orçamento); e a fase mais recente e mais detalhadamente documentada, focada em escalabilidade e automação de infraestrutura via Terraform e Kubernetes, com um HPA de 2 a 5 réplicas e uma trilha de migração planejada (mas não implementada) para AWS EKS.

Estruturalmente, o código é organizado em quatro módulos de domínio — `cadastro` (Cliente, Veículo, Serviço), `ordem-servico` (OrdemServico, Orçamento), `pecas-insumos` (Peça/estoque) e `financeiro` (Pagamento) — mais um módulo transversal de autenticação JWT com três papéis (`ADMIN`, `RECEPCIONISTA`, `MECANICO`). Cada módulo replica internamente a mesma separação em camadas — domain (sem dependências externas), application (use cases dependentes apenas do domínio, proibidos de importar infraestrutura concreta), infrastructure (implementações Prisma dos contratos de repositório do domínio) e presentation (controllers/DTOs) — regra tratada como inegociável na convenção do time ("Application must not import concrete infrastructure classes"; "Domain: ZERO external dependencies"). O modelo de domínio formal, descrito em `docs/ddd.md` e ilustrado por um diagrama de classes tático, define cinco Bounded Contexts: Ordem de Serviço (agregado raiz `OrdemDeServico`, com entidades internas `ItemServico`/`ItemPeca` e Value Objects `StatusOS`/`Orcamento`), Clientes e Veículos (agregado `Cliente` com VOs `CPFCNPJ` e `Endereco`, e entidade `Veiculo`), Estoque e Serviços (agregados independentes `Peca` e `Servico`), Financeiro (contexto descrito apenas em prosa, sem modelagem tática formal de agregado — a lacuna de documentação mais evidente do domínio) e Segurança/Autenticação (agregado `UsuarioAdministrativo` com VO `Credenciais`). Vinte e nove eventos de domínio e seus comandos correspondentes estão catalogados por Bounded Context de código, alinhados a um exercício de Event Storming, embora alguns eventos — notadamente `NotaFiscalEmitida` e estados mais recentes da OS como `AWAITING_PARTS`/`CLOSED_WITHOUT_EXECUTION` — não tenham correspondência plena entre o que está documentado como evento/comando e o que está de fato implementado como rota de API.

O fluxo central do sistema — consistentemente narrado em Domain Storytelling, diagrama de sequência e um relatório real de execução E2E via cURL — é: recepcionista cadastra cliente e veículo e abre a OS (estado `RECEIVED`); mecânico assume a OS (`UNDER_DIAGNOSIS`), diagnostica o veículo e gera o orçamento listando serviços e peças necessários, através do mesmo endpoint que lança os itens (`PATCH /servicos-insumos`), o que muda o estado para `AWAITING_APPROVAL`; o cliente — em uma rota pública, sem autenticação, o único ponto de contato direto do cliente final com a API — aprova ou recusa o orçamento, movendo a OS para `IN_PROGRESS` (com timestamp automático `iniciada_em`) ou, segundo o README (mas não confirmado pelo Event Storming original), para um estado de encerramento sem execução; durante a execução, a falta de peças pode levar a um estado intermediário de espera por peças, documentado apenas no ciclo de vida textual do README; o mecânico finaliza a execução (`FINISHED`, `finalizada_em` automático); o cliente pode aprovar o serviço prestado (outra rota pública); e o recepcionista registra a entrega (`DELIVERED`, `entregue_em` automático). Paralelamente, o registro de um pagamento (`POST /pagamentos/registrar`) está acoplado ao disparo da entrega da OS, embora a regra de negócio exata dessa integração não esteja detalhada em nenhum artefato de modelagem — este é, junto com a ausência de modelagem tática do contexto Financeiro, o ponto mais fraco da documentação de domínio.

Há três divergências documentais que uma IA operando sobre este contexto deve tratar com cautela em vez de tomar como verdade única: primeiro, o enum de estados da Ordem de Serviço tem 6 valores em `AGENTS.md` (schema Prisma) contra 8 valores em `ddd.md` e no README (faltam `AWAITING_PARTS` e `CLOSED_WITHOUT_EXECUTION`) — a fonte mais confiável para decisões de implementação é o `schema.prisma` real, não `AGENTS.md`, que pode estar desatualizado; segundo, o spec de infraestrutura original (`2026-06-22-terraform-kubernetes-design.md`) afirma que o CI nunca roda `terraform apply`, enquanto o README (mais recente) descreve um job de CI que aplica de fato a infraestrutura, mas apenas contra um cluster kind efêmero dentro do próprio runner, nunca contra nuvem persistente — não é uma contradição de fundo, mas uma evolução não retroalimentada ao documento original; terceiro, existem duas propostas concorrentes de Context Map ("trigo" e "vic") com diferenças estruturais reais (a alocação de "Veículo" em bounded contexts diferentes, e o agrupamento ou separação de Peças/Serviços), sem nenhum registro formal de decisão — a versão "vic" é a que efetivamente bate com o texto canônico de `ddd.md` e por isso deve ser tratada como a versão adotada, mas isso é inferência, não uma decisão documentada como tal.

Do ponto de vista de decisões arquiteturais consolidadas: NestJS foi escolhido pela arquitetura modular e injeção de dependência nativa (alinhamento natural com Clean Architecture); PostgreSQL pela consistência transacional, relevante em um domínio com fluxos financeiros e de estoque; Prisma pela tipagem forte integrada ao TypeScript; JWT + bcrypt para autenticação stateless simples, isolada do domínio via um Anti-Corruption Layer explícito no Context Map; eventos de domínio são tratados internamente via um emissor de eventos próprio, sem message broker externo — escolha proporcional ao escopo acadêmico do projeto; Kubernetes (via kind local, com HPA de 2 a 5 réplicas) e Terraform (com estrutura modular deliberada para permitir trocar apenas o "ambiente" na migração futura para EKS, sem reescrever os manifests YAML) foram adotados explicitamente para suportar picos de demanda e expansão para novas unidades da oficina — a motivação de negócio para escalabilidade é declarada de forma explícita no README, ao contrário da maioria das outras decisões técnicas, que aparecem já tomadas sem registro de alternativas descartadas.

Como pendências relevantes para qualquer discussão futura de arquitetura, documentação ou planejamento: a migração EKS é apenas um README-stub, sem implementação; não existe emissão de nota fiscal apesar de estar modelada como evento; não há detalhamento de integrações de notificação real (e-mail/SMS) apesar de o Domain Storytelling descrever uma "notificação" ao cliente; as rotas de fornecedor carregam códigos de requisito (`P-22`/`P-23`) que apontam para uma lista de requisitos externa não presente no repositório; e a adição recente de um template de épico no GitHub (ainda sem épicos concretos de conteúdo) sinaliza a intenção da equipe de formalizar o processo de planejamento arquitetural daqui para frente, citando como exemplos ilustrativos (não decisões) possíveis componentes futuros como API Gateway e Lambda — ou seja, uma direção possível, mas não comprometida, de evolução rumo a componentes serverless na AWS além do caminho EKS já esboçado.
