# ADR-0006: Clean Architecture + DDD como estilo arquitetural

## Status

Aceita

## Contexto

O enunciado da Fase 1 permitia arquitetura livre (citando "arquitetura em
camadas" como piso aceitável); o enunciado da Fase 2 restringiu para
"Clean Architecture **ou** Arquitetura Hexagonal". A equipe precisava de um
estilo que separasse regras de negócio de frameworks/infraestrutura desde o
início, para suportar mudanças de banco/framework sem reescrever o domínio,
e para tornar os casos de uso testáveis por mock de repositório.

## Decisão

Adotar **Clean Architecture combinada com Domain-Driven Design**, com regra
de dependência estrita e unidirecional:

```
presentation → application → domain ← infrastructure
```

- **Domain**: zero dependências externas — sem `PrismaService`, `JwtService`
  ou qualquer lib de framework. Entidades, Value Objects, interfaces de
  repositório, exceções de domínio.
- **Application**: depende só do domain; contém os use cases. Regra
  explícita: application não pode importar classes concretas de
  infraestrutura — usa contratos/tokens do domínio.
- **Infrastructure**: implementa as interfaces de domínio (repositórios
  Prisma, publicador de eventos, filtros).
- **Presentation**: controllers HTTP, DTOs validados com `class-validator`.

## Alternativas consideradas

Nenhuma alternativa (ex.: arquitetura em camadas simples, MVC tradicional)
está documentada com comparativo formal — o enunciado da Fase 2 já restringe
a escolha a Clean Architecture ou Hexagonal, e a equipe optou pela primeira,
sem registro de por que não Hexagonal especificamente.

## Consequências positivas

- Regras de negócio (entidades, use cases) são testáveis sem subir banco ou
  framework — confirmado pelo padrão de teste descrito em
  `docs/contexto-tecnico-consolidado.md` §2 (mock de interfaces de
  repositório, ex.: `jest.Mocked<IClienteRepository>`).
- Trocar Prisma por outro ORM, ou adicionar um segundo mecanismo de entrega
  (ex.: fila) não exigiria tocar no domínio.
- Regra é enforçada como convenção documentada e revisável em code review
  (`docs/contexto-tecnico-consolidado.md` §2, "Princípios e decisões de
  padrão").

## Consequências negativas

- Mais boilerplate por módulo (camadas + interfaces de repositório) do que
  uma arquitetura em camadas simples exigiria.
- Depende de disciplina de code review para não vazar infraestrutura para
  application/domain — não há enforcement automatizado (lint rule) além da
  convenção escrita.

## Riscos

- **Baixo**: nenhuma ferramenta de lint arquitetural (ex.: dependency-cruiser)
  encontrada — a regra de camadas é hoje só documental, não é verificada
  automaticamente em CI.

## Referências

- [`docs/ddd.md`](../ddd.md)
- `docs/contexto-tecnico-consolidado.md` §2 (regras de camada, princípios de padrão)
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #1)
