# language: pt
# Fluxo distribuído da Ordem de Serviço (Saga coreografada, ADR-0016).
# Fonte dos passos: docs/architecture/saga-flow.md (§1 e §3) e docs/architecture/event-catalog.md.
# Execução e Billing estão simulados (eventos entregues ao consumidor da saga). Os ajustes deste
# arquivo em relação ao desenho original e o motivo de cada um estão em test/bdd/README.md.
# Decisão da suíte e do ambiente: docs/adr/0023-ferramenta-bdd-suite-saga.md.
@saga
Funcionalidade: Fluxo da Ordem de Serviço pela Saga entre os três serviços
  Para que a recepção, o mecânico e o cliente acompanhem um reparo de ponta a ponta
  Quero que a Ordem de Serviço atravesse OS Service, Billing Service e Execução e Produção por eventos
  E que ela termine em FINISHED ou seja compensada até CLOSED_WITHOUT_EXECUTION

  Contexto:
    Dado que o OS Service está no ar com o banco de teste
    E que o Billing Service e a Execução e Produção são simulados por eventos entregues ao consumidor da saga

  @caminho-feliz
  Cenário: Ordem de Serviço percorre a saga do recebimento até FINISHED
    Dado que as peças do orçamento estão em estoque
    Quando a recepcionista abre a Ordem de Serviço (POST /api/v1/ordens-servico)
    Então a OS está em RECEIVED
    E o evento OrdemServicoRecebida é publicado em os.eventos.v1

    Quando a Execução publica DiagnosticoIniciado
    Então a OS está em UNDER_DIAGNOSIS

    Quando o mecânico define os serviços e as peças (PATCH /api/v1/ordens-servico/{id}/servicos-insumos)
    Então o evento OrcamentoCalculado é publicado em os.eventos.v1

    Quando o Billing publica OrcamentoGerado
    Então a OS está em AWAITING_APPROVAL

    Quando o Billing publica OrcamentoAprovado
    Então as peças da OS são reservadas
    E a OS continua em AWAITING_APPROVAL

    Quando o Billing publica PagamentoConfirmado
    Então a OS registra pago_em e continua em AWAITING_APPROVAL

    Quando a Execução publica ExecucaoIniciada
    Então a OS está em IN_PROGRESS

    Quando a Execução publica ExecucaoConcluida
    Então a OS está em FINISHED

  # Compensação do lado do OS (#338). Billing e Execução compensam a si mesmos nos próprios
  # repositórios (repo-billing, repo-execucao-service); aqui chegam só os eventos deles.
  @compensacao
  Cenário: Pagamento recusado compensa a saga até CLOSED_WITHOUT_EXECUTION
    Dado que as peças do orçamento estão em estoque
    E que a OS chegou a AWAITING_APPROVAL
    Quando o Billing publica OrcamentoAprovado
    Então as peças da OS são reservadas

    Quando o Billing publica PagamentoRecusado
    Então a OS está em CLOSED_WITHOUT_EXECUTION
    E as peças reservadas voltam ao estoque
    E o HistoricoStatusOS registra o motivo "Pagamento recusado pelo Mercado Pago"

    Quando o Billing publica PagamentoRecusado de novo
    Então as peças não voltam ao estoque em dobro

  @compensacao
  Cenário: Falha técnica no início da execução compensa a saga até CLOSED_WITHOUT_EXECUTION
    Dado que as peças do orçamento estão em estoque
    E que a OS chegou a AWAITING_APPROVAL
    Quando o Billing publica OrcamentoAprovado
    Então as peças da OS são reservadas

    Quando a Execução publica EtapaDaSagaFalhou com etapa inicio-execucao
    Então a OS está em CLOSED_WITHOUT_EXECUTION
    E as peças reservadas voltam ao estoque
    E o HistoricoStatusOS registra o motivo "Falha técnica na etapa inicio-execucao (execucao-service): retry esgotado"
