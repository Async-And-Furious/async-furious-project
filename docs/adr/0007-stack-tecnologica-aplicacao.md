# ADR-0007: Stack tecnológica da aplicação — NestJS + PostgreSQL + Prisma

## Status

Aceita

## Contexto

O enunciado da Fase 1 deixava framework, banco e ORM livres (exigindo apenas
justificativa para o banco). A equipe precisava de um framework Node.js com
suporte nativo a injeção de dependência (para viabilizar Clean Architecture,
ver [ADR-0006](./0006-clean-architecture-ddd.md)), um banco com consistência
transacional forte (o domínio tem fluxos financeiros — orçamento, pagamento
— e de estoque, onde inconsistência é inaceitável), e um ORM com tipagem
integrada ao TypeScript.

## Decisão

- **NestJS 10.x** como framework de aplicação.
- **PostgreSQL** como banco de dados (versão evoluiu de 15 para 16 ao longo
  do projeto — ver [`docs/infrastructure/database.md`](../infrastructure/database.md)
  para o estado atual por ambiente; este ADR trata da escolha do *engine*,
  não da versão).
- **Prisma 5.x** como ORM, com camada de repositório própria no domínio (a
  aplicação não expõe o client Prisma diretamente aos use cases).

## Alternativas consideradas

Nenhuma alternativa concorrente (ex.: Express/Fastify puro, TypeORM,
Sequelize, MySQL/MongoDB) está documentada com comparativo — as escolhas
aparecem já tomadas no README, com justificativa de motivo mas sem registro
de descarte de outras opções.

## Consequências positivas

- Injeção de dependência nativa do NestJS mapeia diretamente para a inversão
  de dependência exigida pela Clean Architecture.
- Consistência transacional do PostgreSQL é adequada aos fluxos financeiros
  (orçamento, pagamento) e de estoque do domínio.
- Tipagem forte do Prisma reduz erros de mapeamento objeto-relacional;
  colunas em `snake_case` mapeadas via `@map` mantêm a convenção do banco
  sem vazar para o código TypeScript (camelCase/PascalCase).

## Consequências negativas

- Prisma exige geração de client (`prisma generate`) como passo de build —
  acoplamento de ferramenta que um ORM mais leve não teria.
- Nenhuma avaliação formal de custo/benefício vs. alternativas está
  registrada — se a stack precisar ser revisada no futuro, não há um
  documento de trade-off para consultar, só esta decisão já tomada.

## Riscos

- **Baixo**: nenhum risco de arquitetura identificado — stack madura e
  amplamente adotada no ecossistema Node.js/TypeScript.

## Referências

- `README.md` (seção "Tecnologias")
- `prisma/schema.prisma`
- `docs/contexto-tecnico-consolidado.md` §8 (decisões consolidadas de stack)
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (pontos #2, #3, #4)
