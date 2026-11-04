# OS Service — arquitetura

> **Alvo aceito da Fase 4**, não declaração de implantação concluída. O código
> deste repositório e seu README ainda contêm documentação histórica do
> monólito; a separação e as integrações abaixo são o alvo arquitetural. As
> páginas dos outros serviços podem corresponder a PRs ainda não integrados, e
> não se afirma aqui que o fluxo foi validado em HML.

## Papel e ownership

O OS Service é dono de clientes, veículos, catálogo de serviços, peças/estoque
e do ciclo de vida da Ordem de Serviço. Mantém a fonte de verdade transacional
da OS, seus itens e histórico; não é dono de orçamento/pagamento (Billing) nem
da fila e agregado `Execucao` (Execução e Produção). A topologia aprovada não
usa chamadas REST entre microsserviços nem acesso de um serviço ao banco de
outro. Ver [ADR-0017](./adr/0017-divisao-microsservicos-ownership-dados.md) e
[ADR-0021](./adr/0021-borda-sem-bff.md).

## API e roteamento-alvo

As rotas usam `/api/v1/<recurso>` sem prefixos de serviço. API Gateway encaminha
pela integração privada ao ALB interno; o ALB direciona os paths de Billing e
Execução a esses serviços e deixa os demais no OS Service como destino padrão.
Rotas exigem JWT validado pelo serviço, salvo as rotas públicas abaixo. O
endpoint de status é público no Gateway. Rotas da tabela descrevem o alvo
aceito, não necessariamente a versão atualmente implantada.

| Recurso OS Service | Rotas principais no alvo |
|---|---|
| Autenticação | `POST /api/v1/auth/login` |
| Clientes, veículos e catálogo | `/api/v1/clientes`, `/api/v1/veiculos`, `/api/v1/servicos` (operações CRUD); `GET /api/v1/clientes/:id` e `GET /api/v1/veiculos/:id` |
| Ordens de Serviço | `/api/v1/ordens-servico` (criação, consultas e comandos); `PATCH /api/v1/ordens-servico/{id}/servicos-insumos`; `PATCH /api/v1/ordens-servico/{id}/registrar-entrega` |
| Estado e saúde | `GET /api/v1/ordens-servico/{id}/status` (pública); `GET /api/v1/health/live`; `GET /api/v1/health/ready` |
| Fallback de status | `POST /api/v1/webhooks/service-orders/status` (rota protegida pelo mecanismo legado, não pública no Gateway) |

`/api/v1/orcamentos*`, `/api/v1/pagamentos*` e o webhook Mercado Pago pertencem
ao Billing Service; `/api/v1/execucoes*` pertence ao Execução e Produção. Os
detalhes de roteamento, autenticação e exceções públicas estão na
[topologia de borda](./architecture/edge-topology.md). Rotas antigas do
monólito em outras seções do README são contexto histórico, não contrato do
alvo.

## Eventos Kafka

O OS Service publica no tópico `os.eventos.v1`:

- `OrdemServicoRecebida` → Execução e Produção;
- `OrcamentoCalculado` → Billing Service;
- `EtapaDaSagaFalhou` quando o OS Service detecta falha técnica ou OS parada, conforme as condições descritas no [catálogo de eventos](./architecture/event-catalog.md).

A lista é exemplificativa; consulte o catálogo para contrato e condições completos.

Consome no grupo `os-consumer`:

- `billing.eventos.v1`: `OrcamentoGerado`, `OrcamentoAprovado`,
  `OrcamentoRecusado`, `PagamentoConfirmado`, `PagamentoRecusado` e
  `EtapaDaSagaFalhou`;
- `execucao.eventos.v1`: `DiagnosticoIniciado`, `ExecucaoIniciada`,
  `ExecucaoConcluida` e `EtapaDaSagaFalhou`.

O envelope usa `correlationId = ordemServicoId`. Fonte de contrato e detalhes
de payloads: [catálogo de eventos](./architecture/event-catalog.md) e
[fluxo da Saga](./architecture/saga-flow.md); envelope/topologia: [ADR-0018](./adr/0018-mensageria-contratos-eventos.md).

## Persistência e dependências

- **PostgreSQL/RDS:** fonte de verdade e banco de escrita do OS Service,
  acessado com sua própria credencial. Não compartilha credenciais com os
  demais serviços.
- **DocumentDB:** read model pertencente exclusivamente ao OS Service para
  leituras selecionadas de OS e cliente. É projetado a partir das gravações;
  não substitui o PostgreSQL como fonte de verdade.
- **Kafka:** integração assíncrona com Billing e Execução e Produção.
- **API Gateway + ALB interno:** entrada HTTP aprovada; não há BFF nem REST
  serviço-a-serviço.

O OS Service não consulta banco de outro serviço. Billing e Execução e Produção
usam seus próprios bancos e credenciais. Mais detalhes de ownership e read
model: [persistência](./architecture/persistence-model.md) e
[fronteiras dos serviços](./architecture/service-boundaries.md).

## ADRs transversais

[ADR-0016 — Saga coreografada](./adr/0016-saga-coreografada.md),
[ADR-0017 — ownership por serviço](./adr/0017-divisao-microsservicos-ownership-dados.md),
[ADR-0018 — mensageria e contratos](./adr/0018-mensageria-contratos-eventos.md),
[ADR-0019 — read model DocumentDB](./adr/0019-documentdb-read-model-os-cliente.md),
[ADR-0020 — isolamento por credencial](./adr/0020-bancos-compartilhados-isolamento-credencial.md) e
[ADR-0021 — borda sem BFF](./adr/0021-borda-sem-bff.md).

## Como executar localmente

Requisitos: Node.js 22, pnpm e Docker. Para subir PostgreSQL local e aplicação
com migrações e seed:

```bash
docker compose -f docker-compose.dependencies.yml up -d
pnpm run dev
```

O modo local da aplicação é o ambiente do repositório, não uma execução da
coreografia distribuída. `./scripts/local-up.sh up` é a entrada documentada
para o cluster kind local; detalhes e requisitos de variáveis estão no
[README](../README.md). O alvo de infraestrutura da Fase 4 é descrito em
[edge-topology.md](./architecture/edge-topology.md).
