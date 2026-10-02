# ADR-0020: Bancos compartilhados com isolamento por credencial

## Status

Aceita — complementada em 30/09/2026 (ver [Revisão de 30/09/2026](#revisão-de-30092026)).

## Contexto

A Fase 4 exige que "nenhum serviço pode acessar diretamente o banco de
outro serviço" (enunciado, p.4) e que cada microsserviço tenha "seu próprio
[...] banco de dados" (p.2). Ao mesmo tempo, a infraestrutura atual já fixou
duas decisões de compartilhamento por custo, ambas em conta AWS pessoal de
free tier:

- **Uma única instância RDS PostgreSQL por ambiente**
  (`docs/adr/0004-banco-dados-gerenciado.md`), `tc3-db-${environment}`, hoje
  com um único banco lógico (`workshop`, renomeado para `os_service` — ver
  [Revisão de 30/09/2026](#revisão-de-30092026)).
- **Um único cluster EKS compartilhado** (`docs/adr/0003-kubernetes-eks-orquestracao.md`),
  que os três serviços da Fase 4 (OS, Billing, Execução e Produção) vão
  dividir — decisão que também precisa ser defendida por escrito junto com
  esta.

Provisionar uma instância RDS por serviço (3 instâncias) resolveria o
isolamento com mais margem, mas não é opção viável dentro do orçamento
acadêmico do projeto — o mesmo tipo de restrição que já levou à exclusão do
DocumentDB em favor do DynamoDB (ADR-0019).

## Decisão

Manter **uma única instância RDS por ambiente**, compartilhada pelos três
serviços, com **banco lógico e credencial (usuário/senha) isolados por
serviço**:

| Serviço | Banco lógico (nomes fechados em 30/09/2026) | Motor |
|---|---|---|
| OS Service | `os_service` | PostgreSQL (na instância `tc3-db-${environment}`) |
| Billing Service | `billing` | PostgreSQL (na mesma instância) — **começa vazio**: a tabela `pagamentos` hoje só tem dado de teste, sem dado de produção a migrar |
| Execução e Produção | `execucao_producao` | PostgreSQL (na mesma instância) — schema nasce vazio, modelagem em Feature #320 |

Cada serviço recebe um usuário de banco próprio, com permissão restrita ao
seu banco lógico — nenhum serviço tem credencial capaz de ler ou escrever
no banco de outro. Isso cumpre o requisito de isolamento do enunciado (p.4)
a uma fração do custo de três instâncias RDS separadas. O provisionamento
real dos bancos/credenciais e a renomeação do banco `workshop` atual são
escopo da Feature #315 ("Provisionar os Bancos por Serviço", Epic #312) —
esta ADR fixa a decisão e os nomes, não a aplica em Terraform (mecanismo de
bootstrap, secrets e IRSA na Revisão de 30/09/2026, ao final).

No **DynamoDB**, o isolamento é nativo por tabela: o OS Service é o único
serviço com tabelas DynamoDB (ADR-0019), e a IAM role usada pela aplicação
é restrita, por policy, às tabelas `os-read-model` e `cliente-read-model`
do próprio ambiente — não há usuário DynamoDB compartilhado entre serviços,
porque não há outro serviço com acesso a DynamoDB para compartilhar.

Esta ADR também serve de defesa por escrito, em conjunto, para o **cluster
Kubernetes compartilhado** (ADR-0003) — o mesmo raciocínio de custo
acadêmico que justifica a instância RDS única se aplica ao cluster EKS
único hospedando os três serviços em namespaces/deployments separados.

## Alternativas consideradas

- **Uma instância RDS por serviço** (3 instâncias): rejeitada — custo
  incompatível com conta acadêmica de free tier, sem ganho de isolamento
  relevante para a avaliação da Fase 4 frente ao que o isolamento por
  credencial já entrega.
- **Um único banco lógico compartilhado, sem separação de credencial**
  (todos os serviços usando a mesma `DATABASE_URL` e schemas Prisma
  distintos dentro do mesmo banco): rejeitada — não cumpre o requisito do
  enunciado (p.4); qualquer serviço com a mesma credencial poderia, em
  tese, consultar a tabela de outro, mesmo que a aplicação "combine" não
  fazer isso. Isolamento por credencial é o que torna a regra
  tecnicamente verificável, não apenas uma convenção de código.
- **Cluster Kubernetes dedicado por serviço**: descartado pelo mesmo motivo
  de custo — cada cluster EKS adicional é mais um control plane cobrado,
  inviável em conta de free tier para três serviços.

## Consequências positivas

- Cumpre o isolamento exigido pelo enunciado (p.4) de forma verificável
  (credencial por serviço), sem o custo de três instâncias RDS.
- Reaproveita 100% a infraestrutura de banco e de cluster já existente da
  Fase 3 — nenhuma decisão nova de topologia de rede ou de VPC.
- Billing Service começar vazio evita o custo de um ETL de dados de teste
  sem valor de avaliação.

## Consequências negativas

- **Single point of failure de infraestrutura**: a instância RDS e o
  cluster EKS compartilhados significam que uma falha neles afeta os três
  serviços simultaneamente — já era o caso na Fase 3 (um único serviço), mas
  na Fase 4 o "raio de explosão" cobre três serviços supostamente
  independentes. Aceito como trade-off de custo acadêmico, não como
  isolamento de falha real.
- Isolamento de dado é por credencial e convenção de acesso, não por rede:
  a instância RDS compartilhada significa que um erro de configuração de
  IAM/rede poderia, em tese, permitir a um serviço alcançar a rede da
  instância inteira (ainda que sem credencial válida para autenticar no
  banco de outro serviço).
- O `Orcamento.onDelete: Cascade` (ainda presente no `schema.prisma`) deixa de
  existir na extração do Billing Service: a Feature #307 (ADR-0017) decidiu
  trocá-lo por referência por id, exatamente por essa razão de fronteira —
  nenhuma consequência nova aqui, só reforça que a ausência de FK real entre
  bancos já era consequência aceita antes desta ADR.

## Riscos

- **Médio**: o provisionamento real das credenciais isoladas por serviço
  (Feature #315) precisa garantir que a policy de IAM/usuário Postgres seja
  de fato restritiva (não apenas "banco lógico diferente, mesma
  superusuário") — esta ADR decide o desenho, não valida a implementação.
- **Baixo**: policy de IAM por tabela DynamoDB (ADR-0019) precisa ser
  revisada quando/se outro serviço algum dia precisar de acesso de leitura
  ao NoSQL do OS Service — hoje nenhum cenário desse tipo está previsto.

## Revisão de 30/09/2026

Revisão do épico #306 (`rev/Epic_1`). A decisão (uma instância RDS por
ambiente, banco lógico e credencial por serviço) **continua valendo**. Esta
seção fecha os pontos que a ADR deixava para a Feature #315.

**Nomes dos bancos.** `os_service`, `billing` e `execucao_producao`
(definitivos, não mais "propostos"). O `db_name = "workshop"` em
`repo-db-infra/modules/rds/main.tf` passa a ser `os_service`, o que
**recria a instância**. Aceito em HML (recriado via down/up); em PROD a
instância tem `deletion_protection`, então a troca exige procedimento
manual e deliberado.

**Bootstrap dos bancos e roles.** Um **Job in-cluster**, executado no
pipeline do OS Service, cria os três bancos e os três roles de forma
**idempotente** (blocos `DO $$ ... $$`). As senhas são geradas por
`random_password` no Terraform e gravadas no Secrets Manager (mesmo padrão
da #315). O artifact do `terraform plan` usa `retention-days: 1`.
**Dívida registrada:** as senhas ficam no state do Terraform.

**Secrets e outputs (`repo-db-infra`).**
- O output `db_connection_secret_arn` passa a apontar para o secret do **OS
  Service** (JSON `host`/`port`/`dbname`/`username`/`password`). Isso
  preserva `deploy-eks.yml` e a CI do `repo-auth-serverless`.
- Novo output `db_master_secret_arn` expõe o secret do usuário master
  (usado só pelo Job de bootstrap).
- O Lambda `authenticate-customer` (`repo-auth-serverless`) passa a usar o
  secret do OS Service (`customer-repository.ts` já suporta o formato).
  **Dívida:** role somente leitura dedicado ao Lambda (hoje ele usa a
  credencial de escrita do OS Service).

**IRSA do DynamoDB.** Criada no `repo-db-infra`, lendo o OIDC provider do
remote state do `repo-k8s-infra` (RFC-004: db lê k8s, nunca o inverso).
Namespace e service account são fixos (ex.: `async-furious` / `os-service`).
A pipeline anota a service account com o `role-arn` lido do output. A
policy continua restrita às tabelas `os-read-model` e `cliente-read-model`
do ambiente.

**Conexões.** Cada serviço usa `connection_limit=3` na `DATABASE_URL`.
Alarme proporcional ao `max_connections` do `db.t4g.micro` (estimado entre
~80 e ~110). Se o consumo não couber, a saída é subir para `db.t4g.small`.

**Provider `postgresql` do Terraform não adotado (Feature #315).** O grupo
optou por não introduzir o provider `postgresql`: é ferramenta nova e traria
um obstáculo real de conectividade, já que o CI do `repo-db-infra` roda em
`ubuntu-latest` e o RDS é privado. O bootstrap é um `Job` Kubernetes
(`scripts/db-bootstrap/`), que roda dentro da VPC no pipeline do OS Service,
com `\gexec` + `format()` no lugar de `DO $$`, porque `CREATE DATABASE` não
roda em bloco `DO`. O Job usa o master (`db_master_secret_arn`) materializado
no namespace só durante a execução, cria os bancos `billing` e
`execucao_producao` e as três roles, revoga `PUBLIC` e roda uma verificação
que exige conexão cruzada recusada. Senhas das roles vêm dos secrets
`tc3-db-*`, não são geradas pelo Job. **Consequência:** Billing e Execução só
sobem depois do 1º deploy do OS.

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.2 e p.4
- `fase4-decisoes-epico1.md`, seção F4 (fora do repositório, workspace local do grupo)
- Issue [#310](https://github.com/Async-And-Furious/async-furious-project/issues/310) — Definir Persistência por Serviço
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- [ADR-0003 — Kubernetes/EKS como plataforma de orquestração](./0003-kubernetes-eks-orquestracao.md)
- [ADR-0004 — Banco de dados gerenciado (RDS PostgreSQL)](./0004-banco-dados-gerenciado.md)
- [ADR-0017 — Divisão em três microsserviços e ownership de dados](./0017-divisao-microsservicos-ownership-dados.md)
- [ADR-0019 — DynamoDB como banco de leitura de OS e Cliente](./0019-dynamodb-read-model-os-cliente.md)
- [`docs/architecture/persistence-model.md`](../architecture/persistence-model.md)
- Issue #315 — Provisionar os Bancos por Serviço (Epic #312)
- `repo-db-infra` (Terraform do RDS, `modules/rds/main.tf`)
