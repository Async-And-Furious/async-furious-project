# 📊 RELATÓRIO DE REVISÃO FINAL — Tech Challenge Fase 1
## Async & Furious · Grupo 74 · NestJS + TypeScript + PostgreSQL

---

## ✅ Pontos Fortes

- **Arquitetura bem estruturada**: módulos `cadastro`, `pecas-insumos`, `ordem-servico` e `auth` seguem Clean Architecture com separação clara de camadas (domain → application → infrastructure → presentation)
- **Value Objects ricos**: `CpfCnpjVo`, `PlacaVeiculoVo` e `ContatoVo` em `src/modules/cadastro/domain/value-objects/` — imutáveis, validam no construtor, têm `equals()` e `toString()`
- **Entidades ricas no módulo cadastro**: `Cliente` e `Veiculo` têm constructor privado, factory method `criar()`, propriedades `readonly` com getters — correto
- **Domain Events bem implementados**: `DomainEvent` base em `src/shared/domain/events/domain-event.base.ts` com `eventId` UUID e `ocorridoEm`, emissão via `EmissorEventos` que wrapa `EventEmitter2`
- **15 policies no módulo OS + 8 em pecas-insumos + 2 no financeiro**: todas com `@Injectable()`, `@OnEvent()` correto, sem lógica HTTP
- **Segurança básica bem configurada**: Helmet (`main.ts:13`), bcrypt com salt rounds configurável, JWT com `expiresIn: '1h'`, guards globais via `APP_GUARD`, `@Public()` corretamente aplicado, UUIDs em todos os IDs
- **Cobertura de testes extensa**: 57 arquivos `.spec.ts` cobrindo guards, VOs, entities, use cases, controllers, repositories, policies e adapters
- **Swagger completo**: todos os DTOs com `@ApiProperty()`, controllers com `@ApiTags()`, Bearer auth configurado, disponível em `/api/docs`
- **Docker correto**: multi-stage build, usuário não-root, `.dockerignore` adequado

---

## 🔴 Bloqueadores (Impedem a entrega)

### B1 — Módulo Financeiro não registrado (endpoint de pagamento inacessível)

**Problema**: Não existe `src/modules/financeiro/financeiro.module.ts`. `AppModule` (`src/app.module.ts`) não importa nada do financeiro. `PagamentoController`, `RegistrarPagamentoPolicy` e `AcionarEntregaOrdemServicoPolicy` **não são carregados pela aplicação**.

**Consequência**: O endpoint `POST /api/v1/pagamentos/registrar` não existe em runtime. A policy `AtualizarStatusEntreguePolicy` em `ordem-servico` escuta `PagamentoRegistrado`, mas esse evento nunca será emitido. A OS nunca chegará ao status `DELIVERED`.

**Correção**:

```typescript
// Criar: src/modules/financeiro/financeiro.module.ts
@Module({
  imports: [DatabaseModule],
  controllers: [PagamentoController],
  providers: [
    PagamentoRepository,
    RegistrarPagamentoPolicy,
    AcionarEntregaOrdemServicoPolicy,
    {
      provide: RegistrarPagamentoUseCase,
      useFactory: (repo: PagamentoRepository, emissor: EmissorEventosService) =>
        new RegistrarPagamentoUseCase(repo, emissor),
      inject: [PagamentoRepository, EmissorEventosService],
    },
  ],
})
export class FinanceiroModule {}
```

Adicionar em `app.module.ts`:
```typescript
imports: [..., FinanceiroModule]
```

---

### B2 — `.env` com secrets commitado no repositório

**Arquivo**: `.env` na raiz do projeto contém:
```
JWT_SECRET="dev-secret-local"
SEED_ADMIN_PASSWORD="changeme123"
```

O `.gitignore` inclui `.env` mas o arquivo já está tracked pelo git.

**Correção**:
```bash
git rm --cached .env .env.local
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
git commit -m "remove .env from tracking"
```

---

### B3 — Entidade `OrdemDeServico` anêmica — transições inválidas possíveis via API

**Arquivo**: `src/modules/ordem-servico/domain/entities/ordem-servico.entity.ts`

A entidade tem apenas propriedades públicas com `!` assertion. Não há state machine interna. As policies fazem `ordemServicoRepository.update(id, { status: 'DELIVERED' })` diretamente **sem validar o status de origem**.

**Risco concreto**: se `PagamentoRegistrado` for emitido com o ID de uma OS em status `RECEIVED`, a policy `AtualizarStatusEntreguePolicy` mudará o status para `DELIVERED` sem resistência. Qualquer falha no fluxo de eventos pode causar transições inválidas silenciosas.

**Correção mínima** — adicionar guard nas policies:
```typescript
// AtualizarStatusEntreguePolicy (e similares)
if (ordem.status !== OrdemStatus.FINISHED) {
  this.logger.warn(`OS ${id} em status inválido para entrega: ${ordem.status}`);
  return;
}
```

**Correção ideal** — mover validação para a entidade com método de transição.

---

## 🟡 Melhorias Importantes (Alta prioridade)

### M1 — Use Cases com `@Injectable()` — viola princípio do CLAUDE.md

**Arquivos afetados**:
- `src/modules/cadastro/application/use-cases/cliente.use-cases.ts` — linhas 12, 22, 32, 42, 52
- `src/modules/cadastro/application/use-cases/veiculo.use-cases.ts` — linhas 12, 22, 32, 42, 52
- `src/modules/pecas-insumos/application/use-cases/peca-insumo.use-cases.ts` — linhas 5, 21, 37, 46, 58, 67

Os módulos correspondentes já usam `useFactory` para instanciar esses use cases, tornando o `@Injectable()` ao mesmo tempo incorreto e redundante. Os use cases de `servico`, `ordem-servico` e `orcamento` estão corretos sem `@Injectable()`.

**Correção**: remover `@Injectable()` e o import de `@nestjs/common` dos arquivos acima.

---

### M2 — `tsconfig.json` sem `strict: true` e com `noImplicitAny: false`

**Arquivo**: `tsconfig.json`, linha 22: `"noImplicitAny": false`

`strict: false` permite `any` implícito em todo o código. No repositório já há `let mockPrismaService: any` em `src/modules/cadastro/infrastructure/repositories/servico.repository.spec.ts:8`.

**Correção**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```
Depois corrigir os erros de compilação resultantes.

---

### M3 — CORS com fallback `true` — aceita qualquer origem em produção

**Arquivo**: `src/main.ts`, linhas 15-19:
```typescript
origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
```

Quando `ALLOWED_ORIGINS` não está definido (ex: container sem essa variável), **toda origem é aceita**.

**Correção**:
```typescript
origin: process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : process.env.NODE_ENV === 'production'
    ? false
    : true,
```

---

### M4 — Coverage threshold não configurado no Jest

**Arquivo**: `jest.config.js` — sem `coverageThreshold`. O README menciona mínimos de 85-90%, mas não há enforcement.

**Correção** — adicionar ao `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 85,
    statements: 85,
  },
},
```

---

### M5 — Casts `as unknown as OrdemDeServico` no repositório

**Arquivo**: `src/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository.ts`, linhas 32, 60, 69, 83, 90

O módulo `cadastro` usa `ClienteMapper` para converter o retorno do Prisma para a entidade de domínio. O módulo `ordem-servico` usa cast direto, que pode esconder bugs de tipo silenciosamente.

---

### M6 — Use Cases de `OrdemServico` sem testes unitários

Os 12 use cases em `src/modules/ordem-servico/application/use-cases/` não têm spec dedicado (diferente de cadastro, peca-insumo e orcamento). As validações de pré-condição (ex: `if (status !== 'RECEIVED') throw`) em `AssumirOrdemServicoUseCase`, `AnalisarVeiculoUseCase`, etc. não estão cobertas por testes unitários.

---

### M7 — `ThrottlerGuard` não é global — rate limiting só no Auth

O throttler está configurado apenas em `AuthModule` com `@UseGuards(ThrottlerGuard)` no `AuthController`. Endpoints que recebem dados sensíveis (ex: `POST /clientes`, `POST /pagamentos`) não têm rate limiting.

---

### M8 — Domain Events do módulo cadastro são dead code

`ClienteCadastradoEvent` e `VeiculoAdicionadoEvent` existem em `src/modules/cadastro/domain/events/` mas não são emitidos nos use cases nem consumidos em nenhuma policy. Ou eles devem ser removidos, ou os use cases de criação devem emiti-los via `EmissorEventos`.

---

## 🟢 Sugestões (Baixa prioridade)

### S1 — Mensagens de erro mistas (português/inglês)
`AuthService` retorna `'Email already registered'` e `'Invalid credentials'` em inglês. Guards retornam `'Authentication required'` e `'Insufficient permissions'`. Considerar padronizar para português.

### S2 — README com informações desatualizadas
README menciona NestJS 11, mas `package.json` mostra `@nestjs/core: 10.4.0`. A estrutura de diretórios documentada no README não corresponde à estrutura real do projeto.

### S3 — Dockerfile com install desnecessário na stage de produção
`Dockerfile` linha 30 executa `pnpm install --frozen-lockfile` na stage de produção, mas a linha 33 copia `node_modules` do builder — o install é sobrescrito e desperdiça tempo de build.

### S4 — Testes duplicados em dois diretórios
`jwt-auth.guard.spec.ts` existe em `src/auth/guards/` e `test/auth/guards/` com conteúdo diferente. Considerar consolidar.

### S5 — `GET /clientes/documento/:cpfCnpj` ausente no escopo da spec
A spec menciona esse endpoint mas o controller tem `GET /clientes/:id` — verificar se está implementado com o path correto.

---

## 📋 Checklist de Cobertura de Testes

| Domínio | Status | Observação |
|---|---|---|
| `cadastro/domain/value-objects/` | ✅ Alta | `cpf-cnpj.vo.spec.ts`, `placa-veiculo.vo.spec.ts`, `contato.vo.spec.ts` extensos |
| `cadastro/domain/entities/` | ✅ Alta | Cliente, Veiculo, Servico testados com casos de erro |
| `cadastro/application/use-cases/` | ✅ Alta | Todos os use cases com cenário feliz + erro |
| `ordem-servico/domain/entity/` | ⚠️ Baixa | Testa só atribuição de propriedades — sem invariantes reais |
| `ordem-servico/application/use-cases/` | 🔴 Ausente | Nenhum spec para os 12 use cases de OS |
| `ordem-servico/application/policies/` | ✅ Alta | `policies.spec.ts` em `test/ordem-servico/` cobre todas |
| `pecas-insumos/domain/entity/` | ✅ Alta | `PecaInsumo` com `debitarEstoque`, `receberDoFornecedor` testados |
| `pecas-insumos/application/policies/` | ✅ Alta | `test/pecas-insumos/policies.spec.ts` cobre todas |
| `financeiro/policies/` | ✅ Alta | `test/financeiro/policies.spec.ts` existe |
| `auth/guards/` | ✅ Alta | JwtAuthGuard + RolesGuard com cenários de permitir/bloquear |
| `auth/strategies/` | ✅ Alta | JwtStrategy testada |
| `shared/emissor-eventos/` | ✅ Alta | Spec dedicado |
| **Threshold configurado?** | 🔴 NÃO | `jest.config.js` sem `coverageThreshold` |

---

## 🔐 Relatório de Segurança

### Vulnerabilidades Encontradas

| Severidade | Tipo | Localização | Descrição | Correção |
|---|---|---|---|---|
| 🔴 CRITICAL | Secrets Exposure | `.env` raiz do repo | `JWT_SECRET` e `SEED_ADMIN_PASSWORD` commitados | `git rm --cached .env && git commit` |
| 🔴 HIGH | Broken Access Control | `financeiro/` | `PagamentoController` não carregado — módulo sem registro em AppModule | Criar `financeiro.module.ts` |
| 🟡 MEDIUM | Security Misconfiguration | `main.ts:17` | CORS `origin: true` quando `ALLOWED_ORIGINS` não definido | Negar em produção por padrão |
| 🟡 MEDIUM | Insecure Design | `ordem-servico/` policies | Transições de estado sem validação de origem | Guard de status nas policies |
| 🟢 LOW | Logging | `auth.service.ts` | Tentativas de login falhas não logadas | Adicionar `Logger.warn()` nos erros de auth |
| 🟢 LOW | Rate Limiting | Todos os controllers exceto Auth | ThrottlerGuard não é global | Configurar throttling global |

### Dependências
Executar `npm audit` antes da entrega para confirmar ausência de CVEs críticos. Atenção especial: `@nestjs/jwt` e `jsonwebtoken` são alvos frequentes.

---

## 📦 Status dos Entregáveis

- [x] Código-fonte: repositório com APIs implementadas
- [x] Dockerfile e docker-compose funcionais
- [x] Swagger configurado em `/api/docs`
- [x] README presente
- [x] `.env.example` presente
- [~] Cobertura de testes — estrutura presente mas threshold não enforçado, use cases de OS sem cobertura
- [~] Event Storming — verificar se link no README está atualizado
- [ ] Módulo financeiro — não carregado em runtime
- [ ] Secrets no git — `.env` commitado

---

## 🎯 Pontuação Estimada por Dimensão

| Dimensão | Peso | Status | Observação |
|---|---|---|---|
| DDD e Arquitetura | Alta | 🟡 | Estrutura geral boa; entidade OS anêmica; módulo financeiro quebrado |
| Qualidade de Código | Média | 🟡 | TypeScript sem strict; use cases com @Injectable inconsistente |
| Segurança (OWASP) | Alta | 🔴 | .env commitado é eliminatório em banca; CORS permissivo |
| Testes (>= 80%) | Alta | 🟡 | Cobertura provavelmente adequada mas sem threshold + use cases OS sem teste |
| Docker e Infra | Média | 🟢 | Multi-stage, non-root, .dockerignore — correto |
| Swagger e API | Média | 🟡 | Completo, mas endpoint de pagamento não carregado |
| README e ADRs | Baixa | 🟡 | README desatualizado (NestJS versão); ADRs não verificados |

---

## 🚀 Plano de Ação Final (ordenado por impacto)

1. **[CRÍTICO — 30min]** Remover `.env` do git tracking:
   ```bash
   git rm --cached .env .env.local
   git commit -m "chore: remove .env from git tracking"
   ```

2. **[CRÍTICO — 1h]** Criar `src/modules/financeiro/financeiro.module.ts` e importar em `AppModule` — sem isso o pagamento e a transição para DELIVERED não funcionam

3. **[ALTA — 45min]** Adicionar guards de status nas policies de OS (`AtualizarStatusEntreguePolicy`, `AtualizarStatusEmExecucaoPolicy`, etc.) para rejeitar eventos com OS em status inválido

4. **[ALTA — 30min]** Adicionar `coverageThreshold` no `jest.config.js` (80% branches/functions, 85% lines/statements) e rodar `npm run test:cov` para confirmar que passa

5. **[ALTA — 20min]** Remover `@Injectable()` dos use cases de `cliente.use-cases.ts`, `veiculo.use-cases.ts` e `peca-insumo.use-cases.ts`

6. **[ALTA — 1-2h]** Criar `test/ordem-servico/use-cases/ordem-servico.use-cases.spec.ts` cobrindo pelo menos: criar OS, assumir (status inválido), analisar, finalizar execução, registrar entrega

7. **[MÉDIA — 15min]** Corrigir CORS em `main.ts:17` para negar todas as origens em produção quando `ALLOWED_ORIGINS` não definido

8. **[MÉDIA — 20min]** Atualizar `tsconfig.json` com `"strict": true` e corrigir erros de tipagem resultantes

9. **[BAIXA — 30min]** Atualizar README com versão correta do NestJS e estrutura de diretórios real

10. **[BAIXA — 20min]** Executar `npm audit` e documentar resultado no README como evidência para a banca
