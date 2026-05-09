# Relatorio de Vulnerabilidades

Data de consolidacao: 2026-05-08
Projeto: Async & Furious - Tech Challenge Fase 1

## Escopo
- Aplicacao back-end (NestJS + Prisma + PostgreSQL)
- Branch analisada: `main` (conforme PDF de entrega)
- Base URL do ambiente de teste dinâmico: `http://localhost:5000`

## 1) Analise SAST - SonarQube/SonarCloud

### Informacoes da analise
- Ferramenta: SonarQube / SonarCloud
- Data da analise: 2026-05-04
- Versao/Branch: `main`

### Evidencias registradas no documento de entrega (PDF)
- Painel principal / Quality Gate
- Vulnerabilidades e Security Hotspots
- Code Smells e Debito Tecnico
- Cobertura de Testes

### Resultado consolidado
- O projeto passou por analise de qualidade e seguranca estatica.
- As evidencias do scan estao apresentadas no PDF de entrega oficial do grupo.

## 2) Analise DAST - OWASP ZAP

### Informacoes da analise
- Ferramenta: OWASP ZAP
- Versao: 2.17.0
- Data da analise: 2026-05-04
- URL alvo (base): `http://localhost:5000`

### Evidencias registradas no documento de entrega (PDF)
- Resumo de alertas por severidade (High / Medium / Low / Informational)
- Informativos tecnicos do ZAP sobre autenticacao e cache

### Observacoes do scan (conforme PDF)
1. O endpoint `POST /auth/login` foi identificado como rota de autenticacao.
2. Respostas 302/400/401 foram classificadas como nao armazenaveis em cache (comportamento esperado para rotas sensiveis/fluxos autenticados).
3. Rotas publicas cacheaveis (`/`, `/api`, `/robots.txt`) nao apresentam risco por nao exporem dados sensiveis.

## 3) Conclusao
- O projeto possui evidencias de analises SAST e DAST exigidas para a entrega.
- Recomendacao de melhoria continua: manter scans em pipeline CI e versionar exportacoes (HTML/JSON) de cada execucao futura em `docs/reports/`.

## 4) Referencias
- Documento PDF de entrega do grupo: `docs/(grupo-74)tech-challenge-fase1-entrega.pdf`
- Workflow DAST: `.github/workflows/zap.yml`
