# Log de agentes

## 2026-10-20 — Mercado Pago Checkout Pro no monólito (#325)

- Aprovar o orçamento cria a preference do Checkout Pro (SDK oficial
  `mercadopago@3.6.1`) e devolve `linkPagamento`; falha no Mercado Pago dá
  `502` e o orçamento segue `PENDING`. Migração aditiva em `pagamentos`
  (`preference_id`, `link_pagamento`, índice em `ordemServicoId`).
- `POST /api/v1/webhooks/mercado-pago` valida o `x-signature` com o validador
  do SDK (`data.id` da query string), reconsulta o pagamento e confirma o
  `Pagamento` aprovado (`CONFIRMADO` + `PagamentoConfirmadoEvent`).
- Validação: 779 testes, type-check e build passando; fluxo testado localmente
  com conta de teste (preference real, pagamento aprovado com cartão de teste,
  notificação assinada simulada). A entrega real do webhook pelo Mercado Pago
  ainda não foi testada. Nenhum deploy, apply ou alteração na AWS.
- Alinhamento com o escopo da #325: `Pagamento.ordemServicoId` único com
  reserva antes de chamar o Mercado Pago (que ignora `X-Idempotency-Key` em
  preferences, testado), aprovação atômica do orçamento, `rejected` terminal
  (`RECUSADO` + `PagamentoRecusadoEvent`), `webhook_recebido` na mesma
  transação, timeout de 5 s com 1 retry, e `POST /pagamentos/registrar` só
  dispara a entrega com pagamento `CONFIRMADO`. Concorrência validada contra o
  banco local (duas aprovações → um pagamento e o mesmo link; três
  notificações → uma atualização).
- Decisões registradas na ADR-0022 (Proposta). Pendente: estorno, segredos
  `MP_*` no k8s/Terraform de HML, rota do
  webhook em `docs/http/routes.yaml` (precisa de um tipo de autenticação novo
  no `route-matrix.py`).

## 2026-09-14 — Fortalecimento da atualização de capacidade do node group em HML

- Fortalecido o passo de capacidade em HML para esperar um nodegroup ACTIVE,
  repetir apenas em `ResourceInUseException`, e sondar a atualização
  capturada até a conclusão, sem mascarar falhas de migração ou rollout.
- Nenhum apply ou deploy na AWS foi executado.

## 2026-09-13 — Seed abrangente de HML/PROD

- Estendido o seed determinístico e não destrutivo do Prisma com atualizações
  de senha de funcionários, relacionamentos, dados de fornecedores, reservas,
  pagamentos e histórico de status.
- Adicionados um manifesto seguro e um workflow manual protegido que executa o
  seed duas vezes; nenhuma execução em HML/PROD foi realizada.
- Validação: build passou; typecheck permanece bloqueado por erros de tipo
  preexistentes na spec da estratégia JWT; o Jest não encontra testes
  descobríveis neste checkout.

## 2026-09-10 — Aliases do CLI do orquestrador Python

- Adicionados a seleção padrão de HML e o alias `--prod` ao orquestrador de
  stack em Python, com validação explícita de conflitos; adicionados scripts
  de encaminhamento multiplataforma `aws:apply` e `aws:destroy` no npm e
  atualizados ambos os READMEs.
- Validação: compilação do Python, help do CLI, dry-runs de apply e destroy em
  HML/PROD, rejeição de conflitos e validação do JSON do `package.json`
  passaram. Nenhum apply/destroy na AWS foi executado.

## 2026-09-10

- Substituído o orquestrador de stack em PowerShell pelo script padrão da
  biblioteca do Python 3 `scripts/orchestrate-stack.py`; atualizados ambos os
  READMEs e removido o entrypoint `.ps1` obsoleto. Nenhuma operação na AWS ou
  deploy de workflow foi disparado.
- Validação: compilação de sintaxe do Python e dry-run autenticado de destroy
  com `--what-if` passaram.

## 2026-08-30

- Integrado o modo gateway de HML/PROD no lado do monolito: verificação RS256,
  fallback local HS256 de email/senha, IDs de correlação, telemetria JSON de
  requisição/erro e checks de live/readiness.
- Protegido o webhook de ordem de serviço com uma guarda de segredo
  compartilhado em tempo constante.
- Removida a dependência da AWS Kubernetes do PostgreSQL em cluster. HML/PROD
  consomem `DATABASE_URL` a partir do contrato protegido do RDS; o Terraform
  apenas local pode habilitar seus recursos de PostgreSQL explicitamente.
- Mantidas as migrações controladas do Prisma, o seed de HML tornado
  automático, e o seed de produção condicionado ao dispatch do workflow mais
  `seed_prod=true`.
- Mantidas a publicação de imagem imutável por commit-SHA, a aprovação
  protegida do Environment de produção, as credenciais temporárias da Academy
  para ambos os ambientes lógicos, e a lógica de salvar/restaurar o endpoint
  /32.
- Validação: `pnpm exec jest --runInBand` passou com 709 testes;
  `pnpm run build` passou; `pnpm run lint` passou com os avisos existentes; a
  validação do Terraform não pôde ser concluída porque os providers exigidos
  não estão instalados localmente.
- Adicionados o TargetGroupBinding do AWS Load Balancer Controller, campos
  explícitos de conexão do secret do RDS, validação estrita das claims
  JWT/subject do cliente no gateway, e salvar/restaurar o acesso ao endpoint
  do EKS em PROD. Removido o destroy automático do Terraform da CI; o teardown
  local permanece manual.

## 2026-08-31

- Adicionada migração retrocompatível de `Cliente.ativo` com backfill padrão
  `true`; a validação de cliente do JWT no gateway agora aceita
  `sub=Cliente.id` da Auth Lambda apenas para clientes ativos.
- Adicionadas métricas de requisição no CloudWatch Embedded Metric Format e
  eventos de alarme em JSON sem nova dependência.

## 2026-09-04

- Atualizados os deploys de EKS em HML/PROD para ler a chave pública de Auth
  a partir do contrato do parâmetro SSM `JWT_PUBLIC_KEY_PARAMETER_NAME`, com
  descriptografia e mascaramento linha a linha; nenhuma alteração na AWS foi
  aplicada.
- Tornada a publicação no ECR por commit-SHA segura contra condição de corrida
  para tags imutáveis: tanto pushes bem-sucedidos quanto conflitos
  concorrentes de tag imutável são resolvidos e validam o digest do ECR sem
  excluir ou sobrescrever imagens.

## 2026-08-24 - Acompanhamento do deploy da Academy

- Os deploys da Academy usam runners hospedados e o modo Service LoadBalancer
  sem ALB/IRSA; o comportamento normal de deploy permanece inalterado.
- A sincronização de secrets falha de forma segura (fail closed) quando
  referências obrigatórias da AWS estão ausentes, e nenhum secret, deploy,
  commit ou push foi executado durante este acompanhamento.
