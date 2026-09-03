# Revisão de Domínio para a Fase 3 — Context Map, Domain Storytelling, Event Storming

> Este documento cobre as três revisões pedidas pela Fase 3 num único
> arquivo, porque a conclusão das três é a mesma e curta: **a separação em
> quatro repositórios e a infraestrutura distribuída não alteram o modelo de
> domínio**. Instrução seguida à risca: "não altere o Event Storming apenas
> porque a infraestrutura mudou" e "a infraestrutura não deve ser adicionada
> ao Domain Storytelling quando não fizer parte da narrativa do domínio".

## 1. Context Map — revisão

Artefatos existentes: [`context-map.suggestion.vic.mmd`](../context-map/suggestions/context-map.suggestion.vic.mmd)
(adotado) e [`context-map.suggestion.trigo.jpg`](../context-map/suggestions/context-map.suggestion.trigo.jpg)
(alternativa concorrente).

### Decisão de adoção formalizada aqui

Não havia, antes desta auditoria, nenhum registro explícito de que a versão
**"vic"** foi a adotada — apenas uma inferência por consistência com o texto
de [`ddd.md`](../ddd.md) §3 (5 Bounded Contexts nomeados exatamente como no
Context Map "vic"). **Formalizando**: a versão "vic" é a canônica. A versão
"trigo" é mantida no repositório como registro histórico do processo de
modelagem colaborativa, não como proposta ativa.

### Impacto real da Fase 3 no Context Map

Apenas um Bounded Context muda de natureza de relacionamento:

| Bounded Context | Relação hoje (Context Map "vic") | Muda na Fase 3? |
|---|---|---|
| Segurança e Autenticação | ACL (Anti-Corruption Layer) em relação à OS — já isolado do domínio de negócio | **Sim, na proposta**: o contexto de Segurança deixa de ser código dentro do mesmo processo/repositório e passa a ser um serviço externo (`repo-auth-serverless`), comunicando-se via JWT verificável. A relação conceitual (ACL) **se mantém** — o isolamento que já existia na modelagem agora também existe fisicamente (repositório e processo separados). Não é uma mudança de padrão de relacionamento DDD, é a *implementação* do isolamento já modelado. |
| Clientes e Veículos, Ordem de Serviço, Estoque e Serviços | Shared Kernel / Upstream-Downstream, todos dentro do monólito | Não muda — os quatro Bounded Contexts de negócio continuam no mesmo repositório/processo (`async-furious-project`) |

Nenhum novo Bounded Context é criado pela Fase 3. Os três repositórios de
infraestrutura (`repo-k8s-infra`, `repo-db-infra`) e o de autenticação
(`repo-auth-serverless`) são fronteiras de **deployment/repositório**, não
novos Bounded Contexts de negócio — não devem ser adicionados ao Context Map
como se fossem contextos de domínio.

**Pendência pré-existente, não introduzida pela Fase 3**: a relação
Orçamento↔OS anotada como "Upstream/Downstream bidirecional" no Context Map
"vic" é conceitualmente atípica (upstream/downstream costuma ser
direcional). Mantida como está — revisão de domínio está fora do escopo desta
tarefa de arquitetura.

## 2. Domain Storytelling — revisão

Artefatos existentes: fluxo principal
([`domain-storytelling.suggestion.vic.png`](../domain-storytelling/suggestions/domain-storytelling.suggestion.vic.png))
e 5 cenários complementares (`docs/egon.io/`, renderizados em `docs/static/`).

**Conclusão**: nenhuma mudança necessária. Os atores (Cliente, Recepcionista,
Mecânico) e a narrativa de negócio (cadastro → OS → diagnóstico → orçamento →
aprovação → execução → entrega) são idênticos entre o estado atual e a
proposta Fase 3. A API Gateway, as Functions Serverless e o Kubernetes
**não entram nesta narrativa** — são infraestrutura de suporte, não atores ou
passos do domínio, e adicioná-los violaria a própria natureza do Domain
Storytelling (que já opta deliberadamente por não representar nem "o
Sistema" como ator nesses diagramas, conforme observado na síntese técnica
consolidada).

## 3. Event Storming — revisão

Artefatos existentes: [`event-storming.suggestion.vic.mmd`](../event-storming/suggestions/vic.event_storming.mmd)
(cobre `pecas-insumos`) e a lista textual completa de 29 eventos/comandos por
Bounded Context em [`ddd.md`](../ddd.md) §5.

**Conclusão**: nenhum comando, evento, agregado, política, sistema externo,
ator ou read model muda por causa da Fase 3. A separação em quatro
repositórios é uma decisão de infraestrutura/deployment; conforme a instrução
desta tarefa, mudanças exclusivamente técnicas ficam registradas nos
diagramas arquiteturais e nas ADRs/RFCs (ver [ADR-0001](../adr/0001-separacao-quatro-repositorios.md),
[ADR-0002](../adr/0002-autenticacao-centralizada-api-gateway-serverless.md)),
não no Event Storming.

Duas lacunas **pré-existentes** no Event Storming foram identificadas durante
a auditoria, mas **não são causadas pela Fase 3** e não foram alteradas aqui:

1. Os estados `AWAITING_PARTS` e `CLOSED_WITHOUT_EXECUTION` (presentes no
   enum `SOStatus` real, `prisma/schema.prisma:16-24`, e no ciclo de vida do
   README) não têm eventos de domínio nomeados em `ddd.md` §5.1.
2. O evento `NotaFiscalEmitida`/comando `EmitirNotaFiscal` (contexto
   Financeiro) não corresponde a nenhuma rota de API implementada.

`TODO`: essas duas lacunas devem ser resolvidas pelo grupo como parte da
manutenção do modelo de domínio, não como entregável desta auditoria de
arquitetura.

## Resumo

| Artefato | Alterado nesta tarefa? | Motivo |
|---|---|---|
| Context Map | Apenas anotado (adoção formal da versão "vic" + nota sobre Segurança) | Impacto real e mínimo da Fase 3 |
| Domain Storytelling | Não | Nenhum impacto da Fase 3 na narrativa de domínio |
| Event Storming | Não | Nenhum impacto da Fase 3; gaps existentes são pré-existentes e fora de escopo |
