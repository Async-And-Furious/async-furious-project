# Coleções HTTP

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
