# Documentação DDD

## 1. Introdução

Este documento apresenta a aplicação dos princípios de Domain-Driven Design (DDD) ao projeto Async & Furious, conforme especificado na documentação fornecida para a turma 15SOAT do curso de pós graduação em Software Arcthecture da FIAP. O objetivo é criar um sistema integrado de atendimento e execução de serviços para uma oficina mecânica, com foco em gestão de ordens de serviço, clientes e peças.

## 2. Linguagem Ubíqua (Ubiquitous Language)

| Termo | Definição |
|---|---|
| **Ordem de Serviço (OS)** | Registro principal que engloba todo o processo de atendimento e execução de serviços em um veículo. |
| **Cliente** | Pessoa física ou jurídica que solicita os serviços da oficina. Identificado por CPF/CNPJ. |
| **Veículo** | Automóvel do cliente que será submetido a serviços. Identificado por placa, marca, modelo e ano. |
| **Serviço** | Atividade específica realizada no veículo (ex: troca de óleo, alinhamento). |
| **Peça/Insumo** | Componente ou material utilizado na execução de um serviço. |
| **Orçamento** | Proposta de custo dos serviços e peças para o cliente, gerada automaticamente. |
| **Status da OS** | Estágio atual da Ordem de Serviço (Recebida, Em Diagnóstico, Aguardando Aprovação, Em Execução, Finalizada, Entregue). |
| **Estoque** | Controle da quantidade de peças e insumos disponíveis. |
| **Autenticação JWT** | Mecanismo de segurança para acesso às APIs administrativas. |

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

## 5. Event Storming (Fluxos Principais)


### 5.1. Criação da Ordem de Serviço (OS) - Detalhado com base no Fluxo Fornecido

Este fluxo descreve o processo de criação de uma Ordem de Serviço, desde a interação inicial do cliente até a geração do orçamento, conforme o diagrama de fluxo de criação de OS.

#### Etapas do Fluxo (Baseado no Diagrama):

1.  **Cliente Informa Dados:** O cliente fornece as informações necessárias para a criação da OS.
2.  **Recepcionista Cadastra Veículo:** A recepcionista utiliza os dados do cliente para cadastrar o veículo no sistema.
3.  **Recepcionista Cria OS:** A recepcionista inicia a criação da Ordem de Serviço.
4.  **Mecânico Assume OS:** Um mecânico assume a responsabilidade pela OS.
5.  **Mecânico Analisa Veículo:** O mecânico realiza a análise do veículo para identificar os serviços e peças necessários.
6.  **Mecânico Lista Serviços e Peças:** Com base na análise, o mecânico lista os serviços a serem realizados e as peças/insumos necessários.
7.  **Geração e Envio do Orçamento:** O sistema gera o orçamento com base nos serviços e peças, e o envia ao cliente para aprovação.

#### Eventos de Domínio:

*   `DadosClienteInformados`
*   `VeiculoCadastrado`
*   `OrdemDeServicoIniciada`
*   `OrdemDeServicoAssumidaPorMecanico`
*   `VeiculoAnalisado`
*   `ServicosListadosParaOS`
*   `PecasListadasParaOS`
*   `OrcamentoGerado`
*   `OrcamentoEnviadoParaAprovacao`
*   `OrcamentoAprovado`
*   `OrcamentoRejeitado`
*   `StatusOSAtualizado`
*   `OrdemDeServicoFinalizada`
*   `OrdemDeServicoEntregue`

#### Comandos:

*   `InformarDadosCliente`
*   `CadastrarVeiculo`
*   `IniciarOrdemDeServico`
*   `AssumirOrdemDeServico`
*   `AnalisarVeiculo`
*   `ListarServicosParaOS`
*   `ListarPecasParaOS`
*   `GerarOrcamento`
*   `EnviarOrcamentoParaAprovacao`
*   `AprovarOrcamento`
*   `RejeitarOrcamento`
*   `AtualizarStatusOS`
*   `FinalizarOrdemDeServico`
*   `EntregarOrdemDeServico`

### 5.2. Acompanhamento da OS (Detalhes Adicionais)

#### Eventos de Domínio:

*   `OrdemDeServicoCriada`
*   `ClienteIdentificado`
*   `VeiculoCadastrado`
*   `ServicoAdicionadoAOS`
*   `PecaAdicionadaAOS`
*   `OrcamentoGerado`
*   `OrcamentoEnviadoParaAprovacao`
*   `OrcamentoAprovado`
*   `OrcamentoRejeitado`
*   `StatusOSAtualizado`
*   `OrdemDeServicoFinalizada`
*   `OrdemDeServicoEntregue`

#### Comandos:

*   `CriarOrdemDeServico`
*   `IdentificarCliente`
*   `CadastrarVeiculo`
*   `AdicionarServicoAOS`
*   `AdicionarPecaAOS`
*   `GerarOrcamento`
*   `EnviarOrcamentoParaAprovacao`
*   `AprovarOrcamento`
*   `RejeitarOrcamento`
*   `AtualizarStatusOS`
*   `FinalizarOrdemDeServico`
*   `EntregarOrdemDeServico`

### 5.2. Acompanhamento da OS (Detalhes Adicionais)

Este fluxo detalha as interações para monitorar o progresso de uma Ordem de Serviço, desde a sua criação até a entrega final, incluindo a comunicação com o cliente para aprovação de orçamentos.

#### Eventos de Domínio:

*   `OrdemDeServicoRecebida`
*   `OrdemDeServicoEmDiagnostico`
*   `OrdemDeServicoAguardandoAprovacao`
*   `OrdemDeServicoEmExecucao`
*   `OrdemDeServicoFinalizada`
*   `OrdemDeServicoEntregue`
*   `ProgressoOSConsultadoPeloCliente`

#### Comandos:

*   `MudarStatusParaRecebida`
*   `MudarStatusParaEmDiagnostico`
*   `MudarStatusParaAguardandoAprovacao`
*   `MudarStatusParaEmExecucao`
*   `MudarStatusParaFinalizada`
*   `MudarStatusParaEntregue`
*   `ConsultarProgressoOS`

### 5.3. Gestão Administrativa

Este contexto abrange as operações de CRUD (Create, Read, Update, Delete) para clientes, veículos, serviços e peças, além do monitoramento de ordens de serviço e tempo de execução.

#### Eventos de Domínio:

*   `ClienteCadastrado`
*   `ClienteAtualizado`
*   `ClienteRemovido`
*   `VeiculoCadastrado`
*   `VeiculoAtualizado`
*   `VeiculoRemovido`
*   `ServicoCadastrado`
*   `ServicoAtualizado`
*   `ServicoRemovido`
*   `PecaCadastrada`
*   `PecaAtualizada`
*   `PecaRemovida`
*   `EstoqueAtualizado`
*   `TempoMedioExecucaoMonitorado`

#### Comandos:

*   `CadastrarCliente`
*   `AtualizarCliente`
*   `RemoverCliente`
*   `CadastrarVeiculo`
*   `AtualizarVeiculo`
*   `RemoverVeiculo`
*   `CadastrarServico`
*   `AtualizarServico`
*   `RemoverServico`
*   `CadastrarPeca`
*   `AtualizarPeca`
*   `RemoverPeca`
*   `AtualizarEstoquePeca`
*   `MonitorarTempoMedioExecucao`

### 5.4. Gestão de Peças e Insumos

#### Eventos de Domínio:

*   `PecaCadastrada`
*   `PecaAtualizada`
*   `PecaRemovida`
*   `EstoqueAtualizado`
*   `PecaComEstoqueBaixo`

#### Comandos:

*   `CadastrarPeca`
*   `AtualizarPeca`
*   `RemoverPeca`
*   `AtualizarEstoquePeca`

## 6. Diagramas

Esta seção apresenta as representações visuais dos contextos e do modelo de domínio.

### 6.1. Context Map

O Context Map ilustra as relações entre os diferentes Bounded Contexts identificados no sistema.

![Context Map](/doc/img/context_map.png)

### 6.2. Diagrama de Modelo de Domínio (Tactical Design)

O diagrama abaixo detalha as entidades, agregados e suas relações dentro do núcleo do sistema.

![Domain Model](/doc/img/domain_model.png)

