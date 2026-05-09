# Documentação DDD

## 1. Introdução

Este documento apresenta a aplicação dos princípios de Domain-Driven Design (DDD) ao projeto Async & Furious, conforme especificado na documentação fornecida para a turma 15SOAT do curso de pós graduação em Software Arcthecture da FIAP. O objetivo é criar um sistema integrado de atendimento e execução de serviços para uma oficina mecânica, com foco em gestão de ordens de serviço, clientes e peças.

## 2. Linguagem Ubíqua (Ubiquitous Language)

| Termo | Campo no Código | Definição |
|---|---|---|
| **Ordem de Serviço (OS)** | `OrdemDeServico` | Registro principal que engloba todo o processo de atendimento e execução de serviços em um veículo. |
| **Cliente** | `Cliente` | Pessoa física ou jurídica que solicita os serviços da oficina. Identificado por CPF/CNPJ. |
| **Veículo** | `Veiculo` | Automóvel do cliente que será submetido a serviços. Identificado por placa, marca, modelo e ano. |
| **Serviço** | `Servico` | Atividade específica realizada no veículo (ex: troca de óleo, alinhamento). |
| **Peça/Insumo** | `PecaInsumo` | Componente ou material utilizado na execução de um serviço. |
| **Orçamento** | `Orcamento` | Proposta de custo dos serviços e peças para o cliente, gerada automaticamente. |
| **Status da OS** | `status` | Estágio atual da Ordem de Serviço: `RECEIVED` (Recebida), `UNDER_DIAGNOSIS` (Em Diagnóstico), `AWAITING_APPROVAL` (Aguardando Aprovação), `IN_PROGRESS` (Em Execução), `FINISHED` (Finalizada), `DELIVERED` (Entregue). |
| **Estoque** | `quantidade_estoque` | Controle da quantidade de peças e insumos disponíveis. |
| **Autenticação JWT** | `AuthModule` | Mecanismo de segurança para acesso às APIs administrativas. |
| **Nome** | `nome` | Nome completo ou razão social do cliente. |
| **Telefone** | `telefone` | Contato telefônico do cliente. |
| **Documento** | `documento` | CPF ou CNPJ do cliente. |
| **Tipo de Documento** | `tipo_documento` | Classificação do documento fiscal: `CPF` (pessoa física) ou `CNPJ` (pessoa jurídica). |
| **Placa** | `placa` | Placa de identificação do veículo (formato Mercosul ou antigo). |
| **Marca** | `marca` | Fabricante do veículo (ex: Toyota, Honda, Fiat). |
| **Modelo** | `modelo` | Versão/modelo do veículo (ex: Corolla, Civic, Palio). |
| **Ano** | `ano` | Ano de fabricação do veículo. |
| **Cor** | `cor` | Cor predominante do veículo. |
| **ID do Cliente** | `id_cliente` | Referência ao cliente dono do veículo ou da OS. |
| **ID do Veículo** | `id_veiculo` | Referência ao veículo associado à OS. |
| **Descrição** | `descricao` | Texto descritivo do problema ou do serviço solicitado na OS. |
| **Entregue em** | `entregue_em` | Data/hora em que a OS foi entregue ao cliente. |
| **Quantidade Mínima** | `quantidade_minima` | Nível mínimo de estoque de uma peça que aciona alerta de reposição. |

## 3. Bounded Contexts (Contextos Delimitados)


### 3.1. Contexto: Ordem de Serviço (OS)

Este contexto lida com a criação, acompanhamento e gestão do ciclo de vida das Ordens de Serviço, incluindo a geração e aprovação de orçamentos, que representam o aspecto financeiro direto da OS.

### 3.2. Contexto: Clientes e Veículos

Responsável pelo cadastro e manutenção das informações de clientes e seus respectivos veículos.

### 3.3. Contexto: Estoque e Serviços

Gerencia o catálogo de serviços oferecidos, o estoque de peças e insumos, e a precificação.

### 3.4. Contexto: Financeiro (Integrado à OS)

Embora não seja um Bounded Context independente para o MVP, os aspectos financeiros relacionados diretamente às Ordens de Serviço (como orçamentos e valores totais) são tratados dentro do Contexto de Ordem de Serviço. Para futuras expansões, um contexto financeiro mais abrangente poderia ser considerado.

### 3.5. Contexto: Segurança e Autenticação

Trata da autenticação de usuários administrativos e da validação de dados sensíveis.

## 4. Modelo de Domínio (Domain Model)


### 4.1. Contexto: Gestão de Ordem de Serviço

#### Agregados:

*   **OrdemDeServico**
    *   **Raiz do Agregado:** OrdemDeServico
    *   **Entidades:** ItemServico, ItemPeca
    *   **Value Objects:** StatusOS, Orcamento

#### Entidades:

*   **OrdemDeServico**
    *   ID da OS
    *   ID do Cliente
    *   ID do Veículo
    *   Data de Abertura
    *   Data de Fechamento (opcional)
    *   Status (Value Object: StatusOS)
    *   Orçamento (Value Object: Orcamento)
    *   Lista de Itens de Serviço (Entidade: ItemServico)
    *   Lista de Itens de Peça (Entidade: ItemPeca)

*   **ItemServico**
    *   ID do Serviço
    *   Descrição do Serviço
    *   Valor Unitário
    *   Quantidade
    *   Valor Total

*   **ItemPeca**
    *   ID da Peça
    *   Descrição da Peça
    *   Valor Unitário
    *   Quantidade
    *   Valor Total

#### Value Objects:

*   **StatusOS**
    *   Valores possíveis: Recebida, Em Diagnóstico, Aguardando Aprovação, Em Execução, Finalizada, Entregue.

*   **Orcamento**
    *   Valor Total dos Serviços
    *   Valor Total das Peças
    *   Valor Total Geral
    *   Aprovado (boolean)

### 4.2. Contexto: Gestão de Clientes e Veículos

#### Agregados:

*   **Cliente**
    *   **Raiz do Agregado:** Cliente
    *   **Entidades:** Veiculo
    *   **Value Objects:** CPFCNPJ, Endereco

#### Entidades:

*   **Cliente**
    *   ID do Cliente
    *   Nome/Razão Social
    *   CPF/CNPJ (Value Object: CPFCNPJ)
    *   Contato (Telefone, Email)
    *   Endereço (Value Object: Endereco)
    *   Lista de Veículos (Entidade: Veiculo)

*   **Veiculo**
    *   ID do Veículo
    *   Placa
    *   Marca
    *   Modelo
    *   Ano

#### Value Objects:

*   **CPFCNPJ**
    *   Número do documento (com validação)
    *   Tipo (CPF ou CNPJ)

*   **Endereco**
    *   Rua
    *   Número
    *   Complemento
    *   Bairro
    *   Cidade
    *   Estado
    *   CEP

### 4.3. Contexto: Gestão de Estoque e Serviços

#### Agregados:

*   **Peca**
    *   **Raiz do Agregado:** Peca
    *   **Value Objects:** QuantidadeEstoque

*   **Servico**
    *   **Raiz do Agregado:** Servico
    *   **Value Objects:** PrecoServico

#### Entidades:

*   **Peca**
    *   ID da Peça
    *   Nome
    *   Descrição
    *   Preço Unitário
    *   Quantidade em Estoque (Value Object: QuantidadeEstoque)

*   **Servico**
    *   ID do Serviço
    *   Nome
    *   Descrição
    *   Preço (Value Object: PrecoServico)

#### Value Objects:

*   **QuantidadeEstoque**
    *   Quantidade atual
    *   Unidade de medida
    *   Ponto de reposição (opcional)

*   **PrecoServico**
    *   Valor do serviço
    *   Moeda

### 4.4. Contexto: Segurança e Autenticação

#### Agregados:

*   **UsuarioAdministrativo**
    *   **Raiz do Agregado:** UsuarioAdministrativo
    *   **Value Objects:** Credenciais

#### Entidades:

*   **UsuarioAdministrativo**
    *   ID do Usuário
    *   Username
    *   Senha (hash)
    *   Papel (ex: Administrador, Mecânico, Atendente)

#### Value Objects:

*   **Credenciais**
    *   Token JWT
    *   Data de Expiração

## 5. Event Storming — Eventos por Bounded Context

Os eventos de domínio estão organizados por BC, refletindo a estrutura de módulos definida em `src/modules/`.

---

### 5.1. BC: Criação e Acompanhamento da OS (`ordem-servico`)

#### Eventos de Domínio (9):

*   `OrdemDeServicoRecebida`
*   `OrdemDeServicoEmDiagnostico`
*   `OrdemDeServicoAguardandoAprovacao`
*   `OrdemDeServicoEmExecucao`
*   `OrdemDeServicoFinalizada`
*   `OrdemDeServicoEntregue`
*   `OrcamentoGerado`
*   `OrcamentoAprovado`
*   `OrcamentoRejeitado`

#### Comandos:

*   `IniciarOrdemDeServico`
*   `MudarStatusParaEmDiagnostico`
*   `MudarStatusParaAguardandoAprovacao`
*   `MudarStatusParaEmExecucao`
*   `MudarStatusParaFinalizada`
*   `MudarStatusParaEntregue`
*   `GerarOrcamento`
*   `AprovarOrcamento`
*   `RejeitarOrcamento`
*   `ConsultarProgressoOS`
*   `AdicionarServicoAOS`
*   `AdicionarPecaAOS`
*   `FinalizarOrdemDeServico`
*   `EntregarOrdemDeServico`

---

### 5.2. BC: Gestão Cadastral (`cadastro`)

#### Eventos de Domínio (9):

*   `ClienteCadastrado`
*   `ClienteAtualizado`
*   `ClienteRemovido`
*   `VeiculoCadastrado`
*   `VeiculoAtualizado`
*   `VeiculoRemovido`
*   `ClienteIdentificado`
*   `DadosClienteInformados`
*   `VeiculoAnalisado`

#### Comandos:

*   `CadastrarCliente`
*   `AtualizarCliente`
*   `RemoverCliente`
*   `CadastrarVeiculo`
*   `AtualizarVeiculo`
*   `RemoverVeiculo`
*   `IdentificarCliente`
*   `InformarDadosCliente`
*   `AnalisarVeiculo`

---

### 5.3. BC: Gestão de Peças e Insumos (`pecas-insumos`)

#### Eventos de Domínio (8):

*   `PecaCadastrada`
*   `PecaAtualizada`
*   `PecaRemovida`
*   `EstoqueAtualizado`
*   `PecaComEstoqueBaixo`
*   `PecasListadasParaOS`
*   `PecaAdicionadaAOS`
*   `ReposicaoEstoqueSolicitada`

#### Comandos:

*   `CadastrarPeca`
*   `AtualizarPeca`
*   `RemoverPeca`
*   `AtualizarEstoquePeca`
*   `ListarPecasParaOS`
*   `SolicitarReposicaoEstoque`

---

### 5.4. BC: Gestão Financeira (`financeiro`)

#### Eventos de Domínio (3):

*   `PagamentoRegistrado`
*   `PagamentoProcessado`
*   `NotaFiscalEmitida`

#### Comandos:

*   `RegistrarPagamento`
*   `ProcessarPagamento`
*   `EmitirNotaFiscal`

## 6. Diagramas


### 6.1. Context Map

O Context Map ilustra as relações entre os diferentes Bounded Contexts identificados no sistema.

![Context Map](/doc/img/context_map.png)

### 6.2. Diagrama de Modelo de Domínio (Tactical Design)

O diagrama abaixo detalha as entidades, agregados e suas relações dentro do núcleo do sistema.

![Domain Model](/doc/img/domain_model.png)

### 6.3. Domain Storytelling: Fluxo de Criação e Acompanhamento da OS

Este diagrama narra a interação entre os atores e o sistema no processo de criação e acompanhamento de uma Ordem de Serviço.

![Domain Storytelling OS](/doc/img/os_flow.png)

### 6.4. Event Storming: Fluxo de Gestão de Peças e Insumos

Este diagrama visualiza os eventos e comandos envolvidos na gestão de peças e insumos.

![Event Storming Peças e Insumos](/doc/img/event_storming.png)


