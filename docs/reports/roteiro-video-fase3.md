# Roteiro do vídeo de demonstração — Tech Challenge Fase 3 (parte 3/3)

Este é o terceiro vídeo do conjunto de entrega. Os outros dois já estão prontos:
1. Rotas do API Gateway e da aplicação funcionando no Insomnia — 6 min (colega 1).
2. Monitoramento com New Relic — 3 min (colega 2).

Esta parte (intro + repositórios + pipeline) deve ficar entre 5 e 6 minutos, para o total não passar de 15 minutos.

Preparação antes de gravar:
- Abas abertas: repositório principal no GitHub, `repo-auth-serverless`, `repo-k8s-infra`, `repo-db-infra`, aba de Actions do repositório principal.
- Ter uma alteração pequena e inofensiva pronta em uma branch a partir de `develop` (ex.: ajuste de comentário ou log), para abrir o PR e mergear ao vivo e disparar o deploy de homologação.
- Confirmar de antemão qual workflow builda/deploia: `deploy-eks.yml` ("Deploy monolith to Academy EKS"), que tem dois jobs, `deploy-hml` (dispara em push para `develop`) e `deploy-prod` (dispara em push para `main`). Vale já deixar uma execução recente de cada um localizada no histórico do Actions, caso não dê tempo de esperar a nova rodar por completo.

---

## 0:00 – 1:00 | Intro

**Fala:**
"Fechando a demonstração do Tech Challenge da Fase 3 do grupo Async & Furious. Nos vídeos anteriores vocês já viram as rotas do API Gateway e da aplicação funcionando de ponta a ponta, e o monitoramento com New Relic. Nesta parte eu vou mostrar como o projeto está organizado em repositórios, e como funciona a esteira de CI/CD: o que acontece quando a gente sobe código para a branch de desenvolvimento, e o que acontece quando isso vai para produção."

---

## 1:00 – 2:30 | Os 4 repositórios

**Fala:**
"O projeto está separado em quatro repositórios independentes, cada um com seu próprio pipeline de CI/CD e deploy automático para a nuvem.

O `async-furious-project` é a aplicação principal em NestJS, com as regras de negócio de clientes, veículos, ordens de serviço e peças, rodando dentro do cluster Kubernetes.

O `repo-auth-serverless` concentra as Lambdas de autenticação por CPF que vocês já viram funcionando no vídeo do Insomnia.

O `repo-k8s-infra` tem todo o Terraform da infraestrutura Kubernetes: VPC, cluster EKS e ECR.

E o `repo-db-infra` provisiona o banco de dados gerenciado, um RDS PostgreSQL, também via Terraform.

Em todos eles a branch `main` é protegida: sem commit direto, só entra código via Pull Request, e só depois que os checks obrigatórios passarem."

*(Navegar rapidamente pelos 4 repositórios no GitHub, mostrando README e a badge/status de CI de cada um.)*

---

## 2:30 – 5:30 | Pipeline verde rodando e disparando uma nova

**Fala:**
"Agora vou mostrar a esteira de CI/CD funcionando ao vivo, e também como ela se comporta diferente dependendo da branch.

Aqui no histórico do Actions dá pra ver as últimas execuções, todas verdes: os testes automatizados com cobertura mínima de 80%, o lint, o build, e os scans de segurança com Trivy e ZAP."

*(Mostrar a aba Actions do repositório principal com histórico de runs verdes.)*

"Agora vou disparar uma nova execução de verdade. Vou abrir um Pull Request a partir de uma branch de feature para a `develop`."

*(Abrir o PR para `develop`, mostrar os checks do PR rodando.)*

"Assim que eu mergear esse PR na `develop`, o workflow de deploy é disparado automaticamente, mas ele sobe para o ambiente de homologação. É esse comportamento: quando o merge acontece na `develop`, quem roda é o job de deploy de homologação, o `deploy-hml`, que builda a imagem, publica no ECR e atualiza a aplicação no cluster de homologação."

*(Fazer o merge do PR na develop, ir até a aba Actions e mostrar o workflow "Deploy monolith to Academy EKS" disparando, apontando o job `deploy-hml` rodando e ficando verde.)*

"Já quando esse código é promovido para a `main` — por exemplo, através de um PR de `develop` para `main` — é o outro job do mesmo workflow que entra em ação, o `deploy-prod`, que builda e sobe a aplicação para o ambiente de produção. Ou seja, a mesma pipeline sabe diferenciar para qual ambiente ela precisa mandar o deploy só olhando para qual branch recebeu o merge: `develop` vai para homologação, `main` vai para produção."

*(Se der tempo dentro da janela de 5:30, abrir um PR de `develop` para `main` e mostrar o job `deploy-prod` dessa vez. Se não der tempo de esperar o merge completo, mostrar uma execução anterior já finalizada do `deploy-prod` no histórico do Actions, deixando claro que é a mesma lógica.)*

"O mesmo padrão de proteção e deploy automático por ambiente se repete nos outros repositórios: mudanças em `repo-k8s-infra` e `repo-db-infra` passam por terraform plan em todo PR, e o apply automático acontece ao mergear, com o mesmo critério de branch para homologação e produção."
