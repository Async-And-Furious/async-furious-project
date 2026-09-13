# Seed abrangente HML/PROD

O workflow manual `.github/workflows/seed-eks.yml` usa os jobs protegidos
existentes de deploy, portanto a aprovação do ambiente `hml` ou `production` é
obrigatória. Ele executa o seed duas vezes, sem apagar ou resetar dados.

Configure, como secrets do ambiente correspondente:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_RECEPCIONISTA_PASSWORD`
- `SEED_MECANICO_PASSWORD`
- `SEEDED_CPF` (obrigatório no workflow; CPF válido, sempre mascarado e nunca incluído no manifesto)

Os valores de infraestrutura (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`JWT_SECRET`, `WEBHOOK_SECRET`) e as variables já usadas por
`deploy-eks.yml` também precisam existir. Senhas e CPF não são impressos.

O manifesto seguro contém somente papéis, e-mails, IDs e status. O resumo do
job é limitado; não copie logs de pods para fora do GitHub Actions.

Após a aprovação, use o endpoint do gateway (nunca o Service privado):

```bash
curl --fail-with-body "$API_BASE/api/v1/health/live" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Correlation-Id: seed-check"
curl --fail-with-body "$API_BASE/api/v1/ordens-servico" \
  -H "Authorization: Bearer $TOKEN"
```

`TOKEN` deve ser obtido pelo fluxo de autenticação aprovado e não deve ser
gravado em shell history, logs ou artefatos.
