# language: pt
# Fluxo distribuído da Ordem de Serviço (Saga coreografada, ADR-0016).
# Fonte dos passos: docs/architecture/saga-flow.md (§1 e §3) e docs/architecture/event-catalog.md.
# Status, eventos, tópicos e rotas usam exatamente os nomes desses documentos.
# Decisão da suíte e do ambiente: docs/adr/0023-ferramenta-bdd-suite-saga.md.
@saga
Funcionalidade: Fluxo da Ordem de Serviço pela Saga entre os três serviços
  Para que a recepção, o mecânico e o cliente acompanhem um reparo de ponta a ponta
  Quero que a Ordem de Serviço atravesse OS Service, Billing Service e Execução e Produção por eventos reais no Kafka
  E que ela termine em FINISHED ou seja compensada até CLOSED_WITHOUT_EXECUTION

  Contexto:
    Dado que o OS Service, o Billing Service e a Execução e Produção estão no ar
    E que o Kafka, o PostgreSQL, o mongo e o stub do Mercado Pago estão disponíveis

  @caminho-feliz
  Cenário: Ordem de Serviço percorre a saga do recebimento até FINISHED
    Dado que as peças do orçamento estão em estoque
    Quando a recepcionista abre a Ordem de Serviço (POST /api/v1/ordens-servico)
    Então a OS está em RECEIVED
    E o evento OrdemServicoRecebida é publicado em os.eventos.v1
    E a Execucao da OS está em AGUARDANDO_DIAGNOSTICO

    Quando o mecânico inicia o diagnóstico (PATCH /api/v1/execucoes/{id}/iniciar-diagnostico)
    Então a Execucao está em EM_DIAGNOSTICO
    E o evento DiagnosticoIniciado é publicado em execucao.eventos.v1
    E a OS está em UNDER_DIAGNOSIS

    Quando o mecânico define os serviços e as peças (PATCH /api/v1/ordens-servico/{id}/servicos-insumos)
    Então o evento OrcamentoCalculado é publicado em os.eventos.v1
    E o Orcamento está em PENDING
    E o evento OrcamentoGerado é publicado em billing.eventos.v1
    E a OS está em AWAITING_APPROVAL

    Quando o cliente aprova o orçamento (PATCH /api/v1/orcamentos/{ordemServicoId}/aprovar)
    Então a resposta contém linkPagamento
    E o Orcamento está em APPROVED
    E o Pagamento está em AGUARDANDO_PAGAMENTO
    E o evento OrcamentoAprovado é publicado em billing.eventos.v1
    E as peças da OS são reservadas
    E a OS continua em AWAITING_APPROVAL

    Quando o Mercado Pago notifica o pagamento aprovado (POST /api/v1/webhooks/mercado-pago, com assinatura válida) e a reconsulta devolve approved
    Então o Pagamento está em CONFIRMADO
    E o evento PagamentoConfirmado é publicado em billing.eventos.v1
    E a Execucao está em AGUARDANDO_REPARO
    E a OS registra pago_em e continua em AWAITING_APPROVAL

    Quando o mecânico inicia o reparo (PATCH /api/v1/execucoes/{id}/iniciar-reparo)
    Então a Execucao está em EM_REPARO
    E o evento ExecucaoIniciada é publicado em execucao.eventos.v1
    E a OS está em IN_PROGRESS

    Quando o mecânico conclui a execução (PATCH /api/v1/execucoes/{id}/concluir)
    Então a Execucao está em CONCLUIDA
    E o evento ExecucaoConcluida é publicado em execucao.eventos.v1
    E a OS está em FINISHED

  # Depende da #338 (compensações): este cenário só passa depois que as compensações estiverem implementadas.
  @compensacao @depende-338
  Cenário: Pagamento recusado compensa a saga até CLOSED_WITHOUT_EXECUTION
    Dado que a OS está em AWAITING_APPROVAL com o Orcamento em PENDING
    E que as peças do orçamento estão em estoque

    Quando o cliente aprova o orçamento (PATCH /api/v1/orcamentos/{ordemServicoId}/aprovar)
    Então a resposta contém linkPagamento
    E as peças da OS são reservadas

    Quando o Mercado Pago notifica o pagamento recusado (POST /api/v1/webhooks/mercado-pago, com assinatura válida) e a reconsulta devolve rejected
    Então o Pagamento está em RECUSADO
    E o evento PagamentoRecusado é publicado em billing.eventos.v1
    E a reserva de peças da OS é liberada
    E a OS está em CLOSED_WITHOUT_EXECUTION
    E o HistoricoStatusOS registra o motivo "pagamento recusado"
    E a Execucao está em CANCELADA
    E o Mercado Pago não recebe nenhum estorno, porque nada foi capturado
