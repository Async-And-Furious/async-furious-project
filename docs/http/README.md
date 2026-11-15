# Coleções HTTP

> **Legado da Fase 3.** As coleções desta pasta (`insomnia*`, `postman/`, `ciclo-completo-os.http`,
> `routes.yaml`) e o gerador `scripts/generate-http-collections.py` descrevem o monólito da Fase 3,
> com rotas que já não existem no OS Service (orçamento, pagamento, `assumir`). O contrato da
> Fase 4 é o `openapi.json` de cada serviço: [`openapi/os-service.openapi.json`](openapi/os-service.openapi.json)
> aqui, e `docs/openapi.json` no `repo-billing` e no `repo-execucao-service` (#350).

Importe `postman/async-furious.postman_collection.json` mais o ambiente de HML
ou de PROD, ou importe `insomnia/async-furious.insomnia.json` e selecione o
ambiente correspondente. Todas as credenciais, CPF, tokens, URLs de endpoint e
IDs de seed são variáveis; preencha-as a partir dos secrets e variables
protegidos do GitHub Environment. As requisições de login extraem os três JWTs
de funcionários, e a requisição de cliente extrai o JWT da Lambda de
autenticação por CPF.

O workflow protegido `protected-route-matrix.yml` executa o mesmo contrato de
rotas da coleção contra o ambiente selecionado. Ele falha em caso de 401 ou
403 inesperados e aceita 400 para corpos de mock inválidos ou incompatíveis
com o estado. As rotas DELETE são deliberadamente reportadas como puladas
(skipped) porque essa verificação é não destrutiva.
