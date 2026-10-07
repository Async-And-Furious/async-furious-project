# ADR-0021: Pipeline independente do OS Service

## Status

Aceita

## Decisão

O OS Service valida cada checkout localmente e no GitHub Actions com Node.js
22, instalação reprodutível via pnpm, Prisma generate, testes com cobertura
mínima de 80% uniforme, lint, typecheck e build. A cobertura é publicada como artifact
para tornar o gate auditável.

SonarCloud/SonarQube permanece opcional: quando `SONAR_TOKEN` existe, o
workflow executa análise e aguarda o quality gate; sem o segredo, a etapa é
explicitamente marcada como ignorada e não bloqueia desenvolvimento local.

Deploy e infraestrutura não fazem parte do gate de código. HML e produção só
podem ser acionados pelos workflows de deploy já existentes, com seus
ambientes protegidos e confirmações explícitas. O pipeline desta issue não
executa `terraform apply`, `kubectl apply`, migração compartilhada ou qualquer
recurso AWS.

## Consequências

- Uma PR pode provar a qualidade do código sem acesso a HML.
- Falhas de cobertura, tipagem, lint ou compilação bloqueiam a validação.
- O custo de Sonar é evitado em forks e instalações sem credenciais, mantendo
  um seam pronto para o ambiente configurado.

## Checks e proteção de branch

Os checks produzidos pelo workflow são `Run All Tests` e, quando configurado,
`Sonar quality gate`. Os nomes
devem ser usados na configuração de required status checks do GitHub. A
proteção da branch é uma configuração externa do repositório; este código não
alega criá-la nem consegue confirmá-la sem permissão da API do GitHub.
