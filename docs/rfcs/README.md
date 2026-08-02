# RFCs — Async & Furious

RFCs registram decisões técnicas (não apenas arquiteturais de alto nível — ver [ADRs](../adr/README.md) para isso) que ainda podem evoluir.

## RFCs em andamento (PRs abertos pelo trigo — não duplicadas aqui)

O trigo já escreveu quatro RFCs para os temas de API Gateway, ownership de
VPC, segredos/JWT e versão do banco de dados, cada uma em sua própria branch
com PR aberto. **Não duplicamos o conteúdo nesta branch** para não conflitar
com o trabalho em revisão dele — os documentos abaixo referenciam apenas o
PR:

| Tema | PR | Branch de origem | Status (no GitHub) |
|---|---|---|---|
| API Gateway e integração com EKS (RFC-003) + Ownership da VPC (RFC-004) | [#171](https://github.com/Async-And-Furious/async-furious-project/pull/171) | `docs/rfc-003-004-gateway-vpc-ownership` | Open |
| Motor/versão definitivos do banco (PostgreSQL 16 / RDS) | [#172](https://github.com/Async-And-Furious/async-furious-project/pull/172) | `docs/database-justification-pg16` | Open |
| Estratégia de segredos e assinatura JWT (RFC-006) | [#173](https://github.com/Async-And-Furious/async-furious-project/pull/173) | `docs/rfc-006-secrets-jwt` | Open |

Quando esses PRs forem mesclados, os arquivos passam a existir de verdade em
`docs/rfcs/` nesta pasta — aí sim este índice deve linkar para eles
localmente em vez de para o PR.

## Nossas RFCs

Nenhuma RFC própria (fora do que já está coberto pelos PRs do trigo acima)
foi necessária até o momento desta auditoria.

## Lacuna identificada: `HANDOFF.md`

As RFCs do trigo referenciam repetidamente um arquivo `HANDOFF.md` (ex.:
"HANDOFF.md §20", "§6.1") como lista mestra de decisões da Fase 3.
**`HANDOFF.md` não foi encontrado em nenhuma branch de nenhum dos quatro
repositórios**, nem localmente. `TODO`: localizar ou reconstruir esse
documento.
