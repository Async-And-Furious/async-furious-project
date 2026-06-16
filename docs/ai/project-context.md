# Project Context

Este documento consolida o conhecimento do repositório para uso por agentes de IA responsáveis por arquitetura, análise de requisitos e implementação.

## 1. Project Overview

**Nome do projeto**

- Async Furious
- Sistema de Gestão para Oficina Mecânica
- Mechanic Shop Management System

**Objetivo de negócio**

O projeto entrega um backend para gestão integrada de oficina mecânica. O foco é centralizar atendimento, diagnóstico, execução, orçamento, estoque, clientes, veículos, peças e pagamentos em um sistema único, substituindo processos manuais e planilhas.

**Contexto do Tech Challenge**

O repositório foi desenvolvido para a FIAP, na pós-graduação em Software Architecture (15SOAT), como solução dos desafios da Fase 1 e da Fase 2 do Tech Challenge. A Fase 1 exigiu um MVP funcional com DDD, documentação, testes, Docker e Swagger. A Fase 2 exigiu evolução da arquitetura e da infraestrutura, incluindo Clean Architecture, Kubernetes, Terraform e CI/CD.

**Escopo atual**

O código atual é um backend monolítico em NestJS, organizado em módulos de domínio. Os módulos principais são:

- cadastro
- ordem-servico
- pecas-insumos
- financeiro
- auth
- health

O escopo implementado cobre:

- autenticação JWT com papéis
- CRUD de clientes, veículos, serviços e peças
- ciclo de vida de ordem de serviço
- orçamento e aprovação/recusa
- controle de estoque e reservas
- pagamento que dispara entrega da OS
- Swagger/OpenAPI
- testes unitários e e2e
- Docker e Docker Compose
- workflows GitHub Actions para testes e DAST

Não há, neste repositório, diretórios explícitos de Kubernetes ou Terraform. Também não foram encontrados arquivos ADR.

## 2. Technology Stack

**Linguagem: TypeScript**

Usada em toda a aplicação para tipagem estática, melhor manutenção e compatibilidade com o ecossistema NestJS.

**Framework: NestJS 10**

É a base da API. Organiza módulos, controllers, providers, guards, pipes, filtros e integração com Swagger, Passport e event emitter.

**Banco de dados: PostgreSQL 15/16**

É o banco relacional usado para persistência transacional. O Docker Compose local usa PostgreSQL 15-alpine; os workflows usam PostgreSQL 16 como serviço de CI.

**ORM: Prisma 5**

Responsável pelo acesso ao banco e geração de client tipado. O schema concentra os modelos persistidos e os enums do domínio de infraestrutura.

**Testes: Jest + supertest**

Jest cobre testes unitários e e2e. Supertest é usado nos testes de integração HTTP.

**Containerização: Docker e Docker Compose**

O Dockerfile cria imagem multi-stage e executa a aplicação em usuário não-root. O Compose sobe aplicação e banco local.

**Orquestração: não há Kubernetes no repositório**

A Fase 2 pede manifests K8s, mas não existem arquivos `.yaml` de Kubernetes neste workspace.

**Infraestrutura como código: não há Terraform no repositório**

A Fase 2 pede scripts Terraform, mas não existem arquivos ou diretórios `infra/` com Terraform neste workspace.

**CI/CD: GitHub Actions**

Há workflows para testes e ZAP. O pipeline executa dependências, Prisma, testes unitários, e2e, lint, build e varredura DAST.

## 3. Documentation Map

### Documentos normativos principais

#### docs/Fase 1 - Tech Challenge.pdf

**Finalidade:** requisito original da primeira fase.

**Consultar quando:** validar escopo de MVP, fluxos obrigatórios, entregáveis e restrições iniciais.

**Contém:**

- problema da oficina mecânica
- funcionalidades obrigatórias da Fase 1
- requisitos técnicos
- entregáveis
- exigência de Swagger, Dockerfile, docker-compose, testes e segurança

#### docs/Fase 2 - Tech Challenge.pdf

**Finalidade:** requisito de evolução da aplicação na segunda fase.

**Consultar quando:** planejar infraestrutura, refatoração arquitetural e automação de deploy.

**Contém:**

- evolução para Clean Architecture / Hexagonal
- exigência de K8s, Terraform e CI/CD
- requisitos de deploy e escalabilidade
- entregáveis atualizados

#### README.md

**Finalidade:** visão geral operacional do projeto em português.

**Consultar quando:** entender objetivo, rotas, setup local, auth, fluxo da OS e comandos de execução.

**Contém:**

- objetivo do projeto
- tecnologias
- pré-requisitos
- instruções de execução local
- documentação da API
- rotas principais
- ciclo de vida da OS
- papéis e autenticação
- testes e cobertura

#### README-en.md

**Finalidade:** versão em inglês do README.

**Consultar quando:** um agente precisar de resumo equivalente em inglês.

**Contém:**

- mesma visão geral do README em português
- resumo de stack, rotas e execução local

#### CHANGELOG.md

**Finalidade:** histórico resumido das entregas registradas.

**Consultar quando:** reconstruir o que foi priorizado em ciclos anteriores.

**Contém:**

- anotações de tarefas e reorganização de estrutura

### Documentação de domínio

#### docs/ddd.md

**Finalidade:** referência principal de DDD, linguagem ubíqua, bounded contexts, agregados e event storming.

**Consultar quando:** criar ou validar regras de negócio, delimitar contexto ou entender os diagramas de domínio.

**Contém:**

- linguagem ubíqua
- bounded contexts
- modelo de domínio
- agregados
- eventos de domínio por contexto
- context map
- domain storytelling
- event storming

#### docs/context-map/suggestions/context-map.suggestion.vic.mmd

**Finalidade:** versão textual do context map.

**Consultar quando:** entender relações entre contextos.

**Contém:**

- contexto de Atendimento
- contexto de Operação
- contexto de Inventário
- contexto de Segurança
- relações Shared Kernel, ACL e upstream/downstream

#### docs/others/suggestions/domain-model.suggestion.vic.mmd

**Finalidade:** diagrama tático textual do modelo de domínio.

**Consultar quando:** validar agregados e relações entre entidades.

**Contém:**

- OrdemDeServico
- ItemServico
- ItemPeca
- Cliente
- Veiculo
- Peca
- Servico

#### docs/others/suggestions/os-flow.suggestion.vic.mmd

**Finalidade:** fluxo textual da OS no contexto operacional.

**Consultar quando:** detalhar o ciclo de vida e suas etapas.

**Contém:**

- transições de status da OS
- eventos de início, execução e conclusão

#### docs/event-storming/suggestions/vic.event_storming.mmd

**Finalidade:** versão textual do event storming.

**Consultar quando:** mapear comandos e eventos do domínio.

**Contém:**

- eventos de peças e insumos
- comandos da gestão de estoque

#### docs/domain-storytelling/suggestions/domain-storytelling.suggestion.vic.egn

**Finalidade:** narrativa de domínio para fluxo principal da OS.

**Consultar quando:** modelar interação entre ator e sistema no fluxo de atendimento.

**Contém:**

- sequência narrativa da criação e acompanhamento da OS

#### docs/domain-storytelling/suggestions/domain-storytelling.suggestion.trigo.egn

**Finalidade:** alternativa de narrativa de domínio.

**Consultar quando:** comparar variações da modelagem colaborativa.

**Contém:**

- cenário equivalente em outra versão de storytelling

#### docs/domain-storytelling/suggestions/domain-storytelling.suggestion.vic.png

**Finalidade:** imagem do domain storytelling principal.

**Consultar quando:** leitura visual rápida do cenário.

**Contém:**

- narrativa do fluxo de OS

#### docs/context-map/suggestions/context-map.suggestion.vic.png

**Finalidade:** imagem do context map.

**Consultar quando:** comunicação visual entre contextos.

**Contém:**

- dependências e relações entre bounded contexts

#### docs/event-storming/suggestions/event-storming.suggestion.vic.png

**Finalidade:** imagem do event storming.

**Consultar quando:** revisar eventos e comandos de forma visual.

**Contém:**

- eventos do fluxo de peças e insumos

#### docs/others/suggestions/domain-model.suggestion.vic.png

**Finalidade:** imagem do modelo de domínio tático.

**Consultar quando:** revisar agregados e relações conceituais.

**Contém:**

- classes e relacionamentos do núcleo do domínio

### Documentação operacional e API

#### docs/http/insomnia.yaml

**Finalidade:** coleção de API.

**Consultar quando:** testar manualmente as rotas com exemplos preparados.

**Contém:**

- rotas de auth, clientes, veículos, serviços, OS, peças e pagamentos
- exemplos de payload
- variáveis de ambiente para execução

#### docs/http/ciclo-completo-os.http

**Finalidade:** roteiro REST Client para executar o ciclo completo da OS.

**Consultar quando:** demonstrar o fluxo end-to-end em sequência.

**Contém:**

- login de usuários
- criação de cliente e veículo
- abertura da OS
- aprovação do orçamento
- finalização e entrega
- consulta de tempo médio

#### docs/reports/relatorio-e2e-orcamento-curl.md

**Finalidade:** registro histórico de um fluxo e2e via cURL.

**Consultar quando:** validar respostas esperadas de um fluxo real.

**Contém:**

- exemplos de requests e respostas
- status HTTP observados
- evolução do estado da OS

### Documentação visual adicional

#### docs/static/*.png

**Finalidade:** imagens exportadas dos cenários de storytelling.

**Consultar quando:** precisar de apoio visual para entender narrativas complementares.

**Contém:**

- consulta de OS
- notificação de orçamento
- cadastro de peças
- remoção de peças
- cadastro de serviços

### Observação sobre ADRs

Não foram encontrados arquivos ADR no repositório.

## 4. Business Domain

**Objetivo do sistema**

Gerenciar uma oficina mecânica com rastreabilidade de atendimento, diagnóstico, orçamento, execução, estoque, pagamento e entrega do veículo.

**Principais atores**

- Cliente
- Recepcionista
- Mecânico
- Administrador
- Fornecedor

**Fluxos principais**

1. Cadastro e identificação de cliente e veículo.
2. Abertura da ordem de serviço.
3. Diagnóstico do veículo.
4. Geração de orçamento com serviços e peças.
5. Aprovação ou recusa do orçamento pelo cliente.
6. Reserva/debito de estoque quando há peças.
7. Execução do serviço.
8. Finalização, pagamento e entrega.
9. Gestão administrativa de cadastros e estoque.

**Linguagem ubíqua**

Os termos mais estáveis do domínio são:

- Ordem de Serviço / OS
- Cliente
- Veículo
- Serviço
- Peça / Insumo
- Orçamento
- Estoque
- Pagamento
- Entrega
- Status da OS

Há também termos específicos de modelagem e execução:

- Recebida
- Em diagnóstico
- Aguardando aprovação
- Em execução
- Aguardando peças
- Finalizada
- Entregue
- Encerrada sem execução

## 5. Bounded Contexts

### Cadastro

**Responsabilidade:** cadastro e manutenção de clientes, veículos e serviços.

**Principais entidades:** Cliente, Veiculo, Servico.

**Integrações:** fornece dados para Ordem de Serviço; depende de validação de documento e placa.

**Dependências:** usa repositories Prisma no infrastructure, controllers na presentation e use cases na application.

### Ordem de Serviço

**Responsabilidade:** coordenar o ciclo de vida da OS, orçamento, status e tempo médio de execução.

**Principais entidades:** OrdemDeServico, Orcamento, OsPeca.

**Integrações:** conversa com cadastro, pecas-insumos e financeiro via eventos e ports.

**Dependências:** depende de repositórios internos, do port de backlog de OS e do emissor de eventos.

### Peças e Insumos

**Responsabilidade:** cadastro de peças, controle de estoque, pedido ao fornecedor e liberação de OSs aguardando peças.

**Principais entidades:** PecaInsumo, PedidoFornecedor, ReservaEstoque.

**Integrações:** consome eventos da Ordem de Serviço e do estoque; publica eventos para atualizar o fluxo da OS.

**Dependências:** usa o port de backlog da Ordem de Serviço como anti-corruption layer para liberar ordens pendentes.

### Financeiro

**Responsabilidade:** registrar pagamentos e disparar o fluxo de entrega da OS.

**Principais entidades:** Pagamento.

**Integrações:** emite evento que é consumido pelo módulo de Ordem de Serviço para mover a OS para DELIVERED.

**Dependências:** depende do repositório de pagamento e do emissor de eventos.

### Auth

**Responsabilidade:** autenticação, autorização e papéis.

**Principais entidades:** usuário administrativo via token JWT e roles.

**Integrações:** protege endpoints por guardas.

**Dependências:** JwtStrategy, JwtAuthGuard, RolesGuard e serviço de autenticação.

### Health

**Responsabilidade:** health check da aplicação.

**Principais entidades:** nenhuma.

**Integrações:** expõe endpoint de saúde.

## 6. Aggregates

### OrdemDeServico

**Aggregate Root:** OrdemDeServico.

**Entidades internas:** OsPeca; o orçamento aparece como entidade agregada/valor de domínio, conforme a implementação.

**Invariantes identificadas:**

- só pode ser assumida quando está RECEIVED
- só pode ser analisada quando está UNDER_DIAGNOSIS
- só pode gerar/lançar serviços e insumos quando está UNDER_DIAGNOSIS ou AWAITING_APPROVAL
- só pode ser atualizada até AWAITING_APPROVAL
- só pode finalizar quando está IN_PROGRESS
- só pode aprovar serviço e registrar entrega quando está FINISHED

### Cliente

**Aggregate Root:** Cliente.

**Entidades internas:** Veiculo aparece associado no modelo e no schema, mas a implementação de domínio o trata como agregado relacionado.

**Invariantes identificadas:**

- id obrigatório
- nome obrigatório
- email válido
- telefone válido quando informado
- documento válido conforme tipo CPF/CNPJ

### Veiculo

**Aggregate Root:** Veiculo.

**Entidades internas:** nenhuma explícita.

**Invariantes identificadas:**

- id obrigatório
- marca obrigatória
- modelo obrigatório
- ano em faixa válida
- placa brasileira válida

### Servico

**Aggregate Root:** Servico.

**Entidades internas:** nenhuma explícita.

**Invariantes identificadas:**

- representado como catálogo de serviço

### PecaInsumo

**Aggregate Root:** PecaInsumo.

**Entidades internas:** PedidoFornecedor e ReservaEstoque se relacionam com o fluxo de estoque.

**Invariantes identificadas:**

- quantidade de estoque não pode ficar negativa ao debitar
- quantidade recebida deve ser positiva
- estoque baixo é detectado por threshold mínimo

### PedidoFornecedor

**Aggregate Root:** PedidoFornecedor.

**Entidades internas:** PedidoFornecedorItem.

**Invariantes identificadas:**

- estado do pedido alterna entre PENDENTE e RECEBIDO
- itens do pedido amarram peça e quantidade solicitada/recebida

### Pagamento

**Aggregate Root:** Pagamento.

**Entidades internas:** nenhuma explícita.

**Invariantes identificadas:**

- valor deve ser positivo
- status é alterado internamente para indicar que foi registrado

## 7. Domain Events

### Ordem de Serviço

- OrdemServicoCriada
  - Contexto: ordem-servico
  - Disparador: criação da OS
  - Consequências: confirma o status RECEIVED e inicia cadeias de políticas

- OrdemServicoAssumida
  - Contexto: ordem-servico
  - Disparador: mecânico assume a OS
  - Consequências: muda para UNDER_DIAGNOSIS

- StatusAtualizadoEmDiagnostico
  - Contexto: ordem-servico
  - Disparador: confirmação do diagnóstico
  - Consequências: notificação e encadeamento do fluxo de orçamento

- ServicosEInsumosListados
  - Contexto: ordem-servico
  - Disparador: geração da lista de serviços e insumos
  - Consequências: gera orçamento

- OrcamentoGerado
  - Contexto: ordem-servico
  - Disparador: cálculo do orçamento
  - Consequências: envio do orçamento e transição para aguardar aprovação

- OrcamentoEnviado
  - Contexto: ordem-servico
  - Disparador: orçamento preparado para o cliente
  - Consequências: OS passa para AWAITING_APPROVAL

- OrcamentoAprovado
  - Contexto: ordem-servico
  - Disparador: cliente aprova o orçamento
  - Consequências: libera o início da execução

- OrcamentoAprovadoComPecas
  - Contexto: ordem-servico
  - Disparador: orçamento aprovado com itens de peça
  - Consequências: aciona o contexto de peças para verificar disponibilidade

- OsSemPecasConfirmada
  - Contexto: ordem-servico
  - Disparador: orçamento aprovado sem peças
  - Consequências: inicia execução direta

- PecasReservadas
  - Contexto: ordem-servico / pecas-insumos
  - Disparador: reserva ou baixa de peças confirmada
  - Consequências: muda a OS para IN_PROGRESS quando apropriado

- PecasIndisponiveis
  - Contexto: pecas-insumos
  - Disparador: peças insuficientes ao aprovar orçamento
  - Consequências: OS vai para AWAITING_PARTS

- StatusAtualizadoAguardandoPecas
  - Contexto: ordem-servico
  - Disparador: peças indisponíveis
  - Consequências: OS fica aguardando reposição

- StatusAtualizadoEmExecucao
  - Contexto: ordem-servico
  - Disparador: peças reservadas ou sem peças necessárias
  - Consequências: inicia monitoramento de tempo

- ServicoConcluidoPeloMecanico
  - Contexto: ordem-servico
  - Disparador: mecânico finaliza a execução
  - Consequências: OS vai para FINISHED

- StatusAtualizadoFinalizada
  - Contexto: ordem-servico
  - Disparador: conclusão do serviço
  - Consequências: encerra monitoramento de tempo e prepara notificação

- PagamentoRegistrado
  - Contexto: financeiro / ordem-servico
  - Disparador: pagamento registrado
  - Consequências: OS vai para DELIVERED quando estiver FINISHED

- StatusAtualizadoEntregue
  - Contexto: ordem-servico
  - Disparador: confirmação de pagamento e entrega
  - Consequências: fecha o ciclo operacional

- OrcamentoRecusado
  - Contexto: ordem-servico
  - Disparador: cliente recusa orçamento
  - Consequências: OS vai para CLOSED_WITHOUT_EXECUTION

- StatusAtualizadoEncerradaSemExecucao
  - Contexto: ordem-servico
  - Disparador: recusa do orçamento
  - Consequências: encerra a OS sem execução

### Peças e Insumos

- PecaCadastrada
- PecaAtualizada
- PecaRemovida
- EstoqueAtualizado
- PecaComEstoqueBaixo
- PecasListadasParaOS
- PecaAdicionadaAOS
- ReposicaoEstoqueSolicitada
- PecasNaoExistem
- PecasIndisponiveis
- PecasEmEstoqueConfirmadas
- EstoqueDebitado
- EstoqueAtualizadoAposRecebimento
- BacklogValidadoPecasDisponiveis
- PedidoFornecedorEnviado
- PecasRecebidas

### Financeiro

- PagamentoRegistrado
- PagamentoProcessado
- NotaFiscalEmitida

## 8. Order Lifecycle

O ciclo de vida completo identificado no código e na documentação é:

RECEIVED → UNDER_DIAGNOSIS → AWAITING_APPROVAL → IN_PROGRESS → FINISHED → DELIVERED

Existem ramificações importantes:

- AWAITING_APPROVAL → CLOSED_WITHOUT_EXECUTION quando o orçamento é recusado
- IN_PROGRESS → AWAITING_PARTS quando o orçamento exige peças indisponíveis
- AWAITING_PARTS → IN_PROGRESS quando as peças são recebidas e reservadas

**Status identificados**

- RECEIVED
- UNDER_DIAGNOSIS
- AWAITING_APPROVAL
- IN_PROGRESS
- AWAITING_PARTS
- FINISHED
- DELIVERED
- CLOSED_WITHOUT_EXECUTION

**Transições e regras**

- Criar OS: nasce em RECEIVED.
- Assumir OS: apenas mecânico e apenas se estiver RECEIVED.
- Analisar veículo: apenas se estiver UNDER_DIAGNOSIS.
- Gerar orçamento: permitido em UNDER_DIAGNOSIS ou AWAITING_APPROVAL.
- Aprovar orçamento: move para IN_PROGRESS.
- Recusar orçamento: move para CLOSED_WITHOUT_EXECUTION.
- Se houver peças e elas estiverem indisponíveis, a OS vai para AWAITING_PARTS.
- Se as peças forem confirmadas e reservadas, a OS retorna ou entra em IN_PROGRESS.
- Finalizar execução: move para FINISHED.
- Registrar pagamento: em conjunto com o fluxo financeiro, prepara a entrega.
- Registrar entrega: move para DELIVERED e preenche entregue_em.

**Restrições**

- O controller e as policies bloqueiam transições fora do estado esperado.
- O domínio lança exceções quando uma ação viola a regra de status.
- A OS não deve ser atualizada após avançar além de AWAITING_APPROVAL.

## 9. Architecture Overview

**Estilo arquitetural**

O projeto adota Clean Architecture com forte separação por módulos e influência de DDD. A organização real é:

- presentation
- application
- domain
- infrastructure

**Organização de camadas**

- presentation: controllers, DTOs e mapeamento de transporte
- application: use cases e policies
- domain: entidades, value objects, eventos e interfaces
- infrastructure: repositórios Prisma, listeners, adapters e integrações

**Dependências permitidas**

- presentation → application
- application → domain
- infrastructure → domain contracts e application policies quando necessário por evento
- módulos podem expor providers por portas e interfaces

**Dependências proibidas**

- domain não deve depender de NestJS, Prisma, JWT ou qualquer framework
- application não deve importar classes concretas de infraestrutura para regras centrais
- controllers não devem conter regra de negócio
- repositórios Prisma não devem vazar tipos de persistência para fora da infraestrutura

**Observação de implementação real**

O projeto já utiliza event emitter e policies para coordenar transições entre contextos. Algumas integrações funcionam como ACL ou ports, especialmente entre ordem-servico e pecas-insumos.

## 10. Infrastructure Overview

**Docker**

O Dockerfile usa multi-stage build, instala dependências com pnpm, gera Prisma Client, compila a aplicação e executa em usuário não-root.

**Docker Compose**

Há dois arquivos:

- docker-compose.dependencies.yml: sobe apenas PostgreSQL para desenvolvimento
- docker-compose.yml: sobe banco e aplicação

Finalidade:

- facilitar execução local
- isolar banco como dependência
- permitir ambiente completo com um comando

**Kubernetes**

Não há manifestos Kubernetes neste repositório.

Finalidade esperada pela Fase 2:

- deployment da aplicação
- service
- configmap/secret
- autoscaling

**Terraform**

Não há scripts Terraform neste repositório.

Finalidade esperada pela Fase 2:

- provisionar cluster
- provisionar banco e recursos adjacentes
- documentar infraestrutura como código

**GitHub Actions**

Existem dois workflows principais:

- tests.yml: executa instalação, Prisma generate, testes unitários, banco, e2e, lint e build
- zap.yml: executa baseline scan de DAST em pull request e scan completo em agendamento/manual

Finalidade:

- validar qualidade antes de entrega
- executar varredura de segurança automatizada
- produzir artefatos de relatório

## 11. AI Agent Guidance

### Fontes de verdade do projeto

Ordem de prioridade para decisão técnica e funcional:

1. Requisitos Fase 2
2. Requisitos Fase 1
3. DDD
4. Event Storming
5. Código-fonte

### Regras obrigatórias

- Respeitar DDD
- Respeitar Linguagem Ubíqua
- Respeitar Clean Architecture
- Não violar bounded contexts
- Não criar regras de negócio sem evidência documental

### Workflow recomendado

1. Ler o requisito.
2. Consultar a documentação relevante.
3. Identificar o bounded context.
4. Identificar o aggregate.
5. Identificar os eventos.
6. Validar a arquitetura.
7. Implementar.

### Observações práticas para agentes

- Se houver conflito entre README e código, priorize o comportamento do código e valide com os documentos de Fase 1/Fase 2.
- Se houver conflito entre DDD e implementação, trate a documentação de requisitos como fonte normativa e o código como estado atual do sistema.
- Antes de propor novas regras de negócio, procure evidência em PDFs, DDD, event storming, history de testes ou fluxo HTTP documentado.
- Trate ausências explícitas com cuidado: não assumir Kubernetes, Terraform ou ADRs quando não existirem arquivos no repositório.

### Resumo operacional para IA

Este projeto é um backend monolítico em NestJS para oficina mecânica, orientado por DDD, com ênfase em ordem de serviço, estoque, orçamento, autenticação e automação de entrega. O que mais importa para qualquer agente é preservar o ciclo de vida da OS, os limites entre contextos e os gatilhos por evento.