# ADR-0011: Aprovação de orçamento via API pública síncrona

## Status

Aceita

## Contexto

O enunciado da Fase 2 sugeria "atualização de status da OS via alguma
ferramenta como e-mail" para notificar o cliente sobre o orçamento.
Implementamos algo diferente: rotas HTTP públicas que o próprio
cliente final aciona diretamente, sem nenhuma integração de e-mail. Isto é
um desvio do enunciado, não documentado explicitamente em nenhum lugar
antes deste ADR — vale registrar o porquê.

## Decisão

Expor rotas `@Public()` (sem autenticação) para o cliente final interagir
diretamente com o ciclo da OS:

- `PATCH /ordens-servico/:id/orcamento/aprovar`
- `PATCH /ordens-servico/:id/orcamento/recusar`
- `PATCH /ordens-servico/:id/aprovar-servico`
- `GET /ordens-servico/:id/status`

Nenhuma biblioteca de e-mail (`nodemailer`, `sendgrid`, SES, etc.) está
presente em `package.json` — confirmado por busca nesta auditoria.

## Alternativas consideradas

- **Notificação por e-mail** (sugerida pelo enunciado): não implementada.
  Nenhum documento registra por que foi descartada — é a lacuna real que
  este ADR existe para expor, não para justificar retroativamente com uma
  razão que não está evidenciada.
- **Notificação por SMS/push**: não avaliada, sem evidência de discussão.

## Consequências positivas

- Fluxo simples de implementar e testar (confirmado via
  `docs/reports/relatorio-e2e-orcamento-curl.md`, que exercita esse fluxo
  de ponta a ponta via cURL).
- Sem dependência de provedor de e-mail externo, sem custo, sem
  configuração de SMTP/API key adicional.

## Consequências negativas

- Cliente precisa ter o link/ID da OS em mãos para consultar/aprovar — não
  há nenhum mecanismo de notificação *ativa* (push) avisando que o
  orçamento está pronto; o Domain Storytelling
  (`docs/domain-storytelling/suggestions/`) descreve uma "notificação ao
  cliente" que, na prática, não tem canal técnico real por trás — é
  provavelmente resolvida fora do sistema (telefone, presencial), não pela
  API.
- Rotas públicas sem autenticação são superfície de ataque: qualquer pessoa
  com o ID da OS pode aprovar/recusar o orçamento — não há confirmação de
  identidade do cliente nessas rotas (nem CPF, nem token, nem link
  assinado).

## Riscos

- **Médio — segurança**: rotas `@Public()` de aprovação de orçamento não
  verificam que quem está chamando é de fato o cliente dono da OS. Se o ID
  da OS for previsível ou vazar, terceiros podem aprovar/recusar orçamentos
  alheios. `TODO`: avaliar se isso é aceitável para o escopo acadêmico ou
  se merece um mecanismo de verificação (ex.: token de uso único por OS).

## Atualização (Fase 4 — migração do `Orcamento` para o Billing Service)

**Revisão de 22/09/2026, Feature #307.** A decisão original desta ADR
(rotas públicas de aprovação/recusa síncronas) **continua valendo** — o que
muda é onde o `model Orcamento` e as rotas passam a viver.

- `Orcamento` migra de `ordem-servico` (OS Service) para o **Billing
  Service** (decisão 1.4 do `fase4-decisoes-epico1.md`, formalizada em
  [ADR-0017](./0017-divisao-microsservicos-ownership-dados.md)).
- A FK `id_ordem_servico` → `OrdemServico.id`, hoje `@relation(...,
  onDelete: Cascade)`, vira referência por id sem FK real
  (`ordemServicoId String`), no mesmo padrão que `Pagamento.ordemServicoId`
  já usa. Deletar uma `OrdemServico` deixa de cascatear a exclusão do
  `Orcamento` — consequência aceita, sem mecanismo de compensação definido
  nesta revisão (ver ADR-0017, "Consequências negativas").
- As rotas `PATCH /ordens-servico/:id/orcamento/aprovar` e
  `.../orcamento/recusar` migram junto para o Billing Service, **mantendo o
  comportamento `@Public()`** decidido nesta ADR — não há mudança na
  exposição pública, só na localização física do serviço que a atende.
  `GET /ordens-servico/:id/status` permanece no OS Service (lê o status da
  OS, não do orçamento).
- O risco de segurança já registrado acima (ID previsível, sem verificação
  de identidade) **não é resolvido por esta revisão** — atravessa a
  migração sem mudança.
- Fora do escopo desta revisão (e desta Feature #307): como o Billing
  Service publica o evento de aprovação/recusa para o OS Service consumir
  (Feature de Mensageria, #309) e a extração de código em si (#330).

## Referências

- `README.md` (tabela de rotas "Ordens de Servico")
- `docs/reports/relatorio-e2e-orcamento-curl.md`
- `docs/domain-storytelling/suggestions/domain-storytelling.suggestion.vic.png`
- `docs/contexto-tecnico-consolidado.md` §4
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #8)
- [ADR-0017](./0017-divisao-microsservicos-ownership-dados.md) — divisão em microsserviços e ownership de dados
- [`docs/architecture/service-boundaries.md`](../architecture/service-boundaries.md) — mapa de ownership completo
