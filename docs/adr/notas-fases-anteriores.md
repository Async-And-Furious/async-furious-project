# Notas de trabalho — ADRs das Fases 1 e 2

> Rascunho de trabalho, não é um ADR. Serve para bater ponto a ponto quais
> decisões das Fases 1/2 ainda não têm ADR formal, antes de escrever os
> arquivos finais em `docs/adr/000N-*.md`. Fontes: `Fase 1 - Tech
> Challenge.pdf`, `Fase 2 - Tech challenge.pdf` (enunciados oficiais) e a
> documentação existente do repositório (`docs/ddd.md`, `AGENTS.md`, README),
> de onde as decisões foram inferidas.

## O que os PDFs são (e não são)

Os dois PDFs são os **enunciados do desafio**, não registros de decisão —
eles impõem requisitos/restrições (ex.: "back-end monolítico", "Clean
Architecture ou Hexagonal", "banco livre mas justifique"). A decisão em si
(qual banco, qual estilo dentro do permitido, como implementar o requisito)
tomamos nós e está espalhada em `docs/ddd.md`, `AGENTS.md`,
README. Este documento separa: **o
que o enunciado exigiu** vs. **o que decidimos dentro disso** vs. **se
já existe um ADR**.

## Tabela ponto a ponto

| # | Decisão | Fase | Exigência do enunciado | O que escolhemos | Já documentado em | ADR existe? |
|---|---|---|---|---|---|---|
| 1 | Estilo arquitetural: Clean Architecture + DDD | 1 (reforçado na 2) | F1: livre, "arquitetura em camadas" citada como piso aceitável. F2: "Clean Architecture **ou** Arquitetura Hexagonal" | Clean Architecture + DDD, regra de dependência estrita (`presentation → application → domain ← infrastructure`) | `AGENTS.md`, `docs/ddd.md`, [ADR-0006](./0006-clean-architecture-ddd.md) | **Não** |
| 2 | Framework de aplicação: NestJS | 1 | Livre | NestJS (DI nativa, modular) | [ADR-0007](./0007-stack-tecnologica-aplicacao.md) | **Não** |
| 3 | Banco de dados: PostgreSQL | 1 | "Livre, mas justificar" | PostgreSQL 15 (consistência transacional p/ fluxos financeiros/estoque) | [ADR-0007](./0007-stack-tecnologica-aplicacao.md) | **Não** — ADR-0004 existe mas é sobre RDS *gerenciado* (Fase 3), decisão diferente |
| 4 | ORM: Prisma | 1 | Não exigido | Prisma 5.x | [ADR-0007](./0007-stack-tecnologica-aplicacao.md) | **Não** |
| 5 | Autenticação: JWT local + bcrypt | 1 | "Autenticação JWT para APIs administrativas" (obrigatório) | `@nestjs/jwt` + `@nestjs/passport` + bcrypt, papéis via guards, ACL isolando auth do domínio | [ADR-0008](./0008-autenticacao-local-jwt-rbac.md), Context Map §5.1 | **Não** — ADR-0002 é sobre migrar para auth *centralizada serverless* (Fase 3), decisão diferente |
| 6 | Eventos de domínio internos (sem message broker) | 1/2 | Não exigido | `EventEmitter`/`DomainEvent` próprio, in-process | [ADR-0009](./0009-eventos-dominio-in-process.md) | **Não** |
| 7 | Monolito modular (não microsserviços) | 1 | "Back-end monolítico" (obrigatório) | Monólito com módulos por Bounded Context (`cadastro`, `ordem-servico`, `pecas-insumos`, `financeiro`) | [ADR-0010](./0010-monolito-modular.md) | **Não** — é a exigência que a ADR-0001 (separação em 4 repos, Fase 3) reverte parcialmente; vale registrar o ponto de partida |
| 8 | Aprovação de orçamento via API pública síncrona, não e-mail | 2 | "Atualização de status da OS via alguma ferramenta como e-mail" | Rotas públicas (`@Public()`) `PATCH /orcamento/aprovar`/`recusar` — **sem** integração de e-mail (confirmado: nenhuma lib de e-mail no código) | Não documentado — é um desvio silencioso do enunciado | **Não** |
| 9 | kind (Kubernetes local) + Terraform modular | 2 | "Terraform p/ cluster (local ou cloud)", "K8s com HPA" | kind local, Terraform modular (trilha de migração p/ EKS sem reescrever YAML) | `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md` (status "Approved") | **Parcial** — já existe como spec aprovada, não como ADR numerado |
| 10 | Manifests Kubernetes em YAML puro (não Helm/Kustomize) | 2 | "Manifestos YAML" (obrigatório) | YAML puro em `/k8s`, legibilidade/debug direto | mesmo spec acima | **Parcial** — mesmo caso do #9 |
| 11 | CI/CD via GitHub Actions, `apply` só contra cluster efêmero no runner | 2 | "Pipeline CI/CD... deploy no cluster... aplicação dos manifestos" | GitHub Actions; `validate`+`plan` em PR, `apply` real só em push, contra kind efêmero no próprio runner (nunca nuvem persistente) | README, [ADR-0012](./0012-cicd-github-actions-apply-efemero.md) (conflito com o spec original em `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`) | **Não** |
| 12 | Segurança DAST: OWASP ZAP | 1 | "Relatório de análise de vulnerabilidades" (obrigatório) | OWASP ZAP no pipeline | [ADR-0013](./0013-seguranca-pipeline-zap-trivy.md) | **Não** |
| 13 | Testes automatizados, cobertura mínima | 1 (80%) / 2 (mantida) | F1: 80% em domínios críticos | Cobertura mínima de 80% uniforme, enforçada em `jest.config.js` (`coverageThreshold.global`) | [ADR-0014](./0014-cobertura-minima-testes.md) | **Sim** — formalizada na ADR-0014 |

## Itens só de contexto (provavelmente não geram ADR)

- Vídeo demonstrativo, entrega em PDF, repositório privado com acesso a
  `soat-architecture` — requisitos de processo acadêmico, não decisão de
  arquitetura.
- Swagger para documentação de API — exigido no enunciado (F1), sem
  alternativa real considerada.
- Docker/docker-compose — exigido no enunciado (F1 e F2), implementação
  direta do requisito, sem decisão de trade-off por trás.

## Próximo passo

Confirmar comigo, linha a linha, quais dos 13 pontos acima viram ADR (posso
agrupar itens correlatos num único ADR — ex.: #2+#3+#4 como uma "stack
tecnológica da Fase 1" — ou manter um por decisão, como já é o padrão das
ADRs 0001-0005). Numeração proposta: `0006` em diante, na ordem em que
fecharmos cada ponto.
