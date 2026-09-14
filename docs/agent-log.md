# Log de agentes

## 2026-09-13 — Seed abrangente de HML/PROD

- Estendido o seed determinístico e não destrutivo do Prisma com atualizações
  de senha de funcionários, relacionamentos, dados de fornecedores, reservas,
  pagamentos e histórico de status.
- Adicionado um manifesto seguro e um workflow manual protegido que executa o
  seed duas vezes; nenhuma execução em HML/PROD foi realizada.
- Validação: build passou; typecheck permanece bloqueado por erros de tipo
  preexistentes na spec da estratégia JWT; o Jest não encontra testes
  descobríveis neste checkout.

## 2026-09-10 — Aliases do CLI do orquestrador Python

- Adicionada a seleção padrão de HML e o alias `--prod` ao orquestrador de
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
