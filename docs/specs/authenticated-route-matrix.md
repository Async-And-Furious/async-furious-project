# Matriz de rotas autenticadas

## Contrato

`docs/http/routes.yaml` é o manifesto canônico. Ele contém uma entrada por
`METHOD + path`, com política explícita de `auth`, `role`, `allowed_status`,
`mutating` e `mock_body`. A matriz e as duas coleções HTTP geradas consomem
este arquivo recursivamente, incluindo futuros grupos `routes` aninhados. O
contrato atual tem 48 rotas únicas.

As políticas de autenticação são separadas:

- `customer` e `staff` usam headers JWT `Authorization: Bearer ...`.
- `webhook` usa apenas `X-Webhook-Secret`; nunca deve receber um header JWT.
- O segredo do webhook é exibido apenas como um fingerprint SHA-256
  truncado.

Os mocks usam o UUID all-zero para referências de recursos e não excluem
dados. As entradas DELETE são reportadas como puladas (skipped). O cadastro
usa o endereço de domínio inválido estável definido no manifesto e aceita
`201` no primeiro uso ou `409` quando já existe, tornando as reexecuções
idempotentes sem criar usuários ilimitados.

## Validação

```sh
python scripts/generate-http-collections.py
python scripts/route-matrix.py
pnpm run type:check
pnpm run test -- --runInBand
```

O workflow protegido `protected-route-matrix.yml` executa as mesmas
verificações para um GitHub Environment de HML ou PROD selecionado. Ele não
faz deploy nem aplica infraestrutura.
