# Relatorio E2E via cURL - Fluxo Ate Aprovacao de Orcamento

Data/Hora: 2026-04-25T12:39:36.920Z
Base URL: http://localhost:3000/api/v1

## Etapas

### 1) Registrar usuario
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" -X POST "http://localhost:3000/api/v1/auth/register" -d '{"email":"e2e.user.1777120776790@example.com","password":"senha123456","name":"E2E User 1777120776790"}'
```
Status: 201
Resposta:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5NjI1M2NiZS02ZjgzLTQyZGYtOTZiOC1kNzE3ZTQ3ZTJjZTMiLCJlbWFpbCI6ImUyZS51c2VyLjE3NzcxMjA3NzY3OTBAZXhhbXBsZS5jb20iLCJuYW1lIjoiRTJFIFVzZXIgMTc3NzEyMDc3Njc5MCIsImlhdCI6MTc3NzEyMDc3NiwiZXhwIjoxNzc3MTI0Mzc2fQ.8Lctz1Ez_O5piN3B8CVJDj-SHh2winpWPOAHOS8eLbQ",
  "user": {
    "id": "96253cbe-6f83-42df-96b8-d717e47e2ce3",
    "email": "e2e.user.1777120776790@example.com",
    "name": "E2E User 1777120776790"
  }
}
```

### 2) Login
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" -X POST "http://localhost:3000/api/v1/auth/login" -d '{"email":"e2e.user.1777120776790@example.com","password":"senha123456"}'
```
Status: 200
Resposta:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5NjI1M2NiZS02ZjgzLTQyZGYtOTZiOC1kNzE3ZTQ3ZTJjZTMiLCJlbWFpbCI6ImUyZS51c2VyLjE3NzcxMjA3NzY3OTBAZXhhbXBsZS5jb20iLCJuYW1lIjoiRTJFIFVzZXIgMTc3NzEyMDc3Njc5MCIsImlhdCI6MTc3NzEyMDc3NiwiZXhwIjoxNzc3MTI0Mzc2fQ.8Lctz1Ez_O5piN3B8CVJDj-SHh2winpWPOAHOS8eLbQ",
  "user": {
    "id": "96253cbe-6f83-42df-96b8-d717e47e2ce3",
    "email": "e2e.user.1777120776790@example.com",
    "name": "E2E User 1777120776790"
  }
}
```

### 3) Criar cliente
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -X POST "http://localhost:3000/api/v1/clientes" -d '{"nome":"Cliente E2E 1777120776790","email":"e2e.cliente.1777120776790@example.com","telefone":"11999998888","documento":"76804512065","tipo_documento":"CPF"}'
```
Status: 201
Resposta:
```json
{
  "id": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
  "nome": "Cliente E2E 1777120776790",
  "email": "e2e.cliente.1777120776790@example.com",
  "telefone": "11999998888",
  "documento": "768.045.120-65",
  "tipo_documento": "CPF",
  "created_at": "2026-04-25T12:39:36.892Z",
  "updated_at": "2026-04-25T12:39:36.892Z"
}
```

### 4) Criar veiculo
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -X POST "http://localhost:3000/api/v1/veiculos" -d '{"placa":"ABC4D20","marca":"Toyota","modelo":"Corolla","ano":2020,"cor":"Preto","id_cliente":"de9e3275-23dd-4859-8c09-b213ab2a77fe"}'
```
Status: 201
Resposta:
```json
{
  "id": "16aba024-44bb-4e81-a348-1770e6bb953a",
  "placa": "ABC4D20",
  "marca": "Toyota",
  "modelo": "Corolla",
  "ano": 2020,
  "cor": "Preto",
  "id_cliente": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
  "created_at": "2026-04-25T12:39:36.898Z",
  "updated_at": "2026-04-25T12:39:36.898Z"
}
```

### 5) Criar ordem de servico
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -X POST "http://localhost:3000/api/v1/ordens-servico" -d '{"id_veiculo":"16aba024-44bb-4e81-a348-1770e6bb953a","id_cliente":"de9e3275-23dd-4859-8c09-b213ab2a77fe","descricao":"Revisao geral E2E"}'
```
Status: 201
Resposta:
```json
{
  "id": "0093411a-c3d5-4b79-a341-7b70dbe35cfe",
  "id_veiculo": "16aba024-44bb-4e81-a348-1770e6bb953a",
  "id_cliente": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
  "status": "RECEIVED",
  "descricao": "Revisao geral E2E",
  "valor_total_servicos": "0",
  "valor_total_pecas": "0",
  "valor_total_geral": "0",
  "orcamento_status": "PENDING",
  "orcamento_aprovado": false,
  "created_at": "2026-04-25T12:39:36.903Z",
  "updated_at": "2026-04-25T12:39:36.903Z",
  "entregue_em": null
}
```

### 6) Gerar orcamento
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -X PATCH "http://localhost:3000/api/v1/ordens-servico/0093411a-c3d5-4b79-a341-7b70dbe35cfe/orcamento/gerar" -d '{"valor_total_servicos":300.5,"valor_total_pecas":199.5}'
```
Status: 200
Resposta:
```json
{
  "id": "0093411a-c3d5-4b79-a341-7b70dbe35cfe",
  "id_veiculo": "16aba024-44bb-4e81-a348-1770e6bb953a",
  "id_cliente": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
  "status": "RECEIVED",
  "descricao": "Revisao geral E2E",
  "valor_total_servicos": "300.5",
  "valor_total_pecas": "199.5",
  "valor_total_geral": "500",
  "orcamento_status": "PENDING",
  "orcamento_aprovado": false,
  "created_at": "2026-04-25T12:39:36.903Z",
  "updated_at": "2026-04-25T12:39:36.909Z",
  "entregue_em": null
}
```

### 7) Aprovar orcamento
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -X PATCH "http://localhost:3000/api/v1/ordens-servico/0093411a-c3d5-4b79-a341-7b70dbe35cfe/orcamento/aprovar" -d '{}'
```
Status: 200
Resposta:
```json
{
  "id": "0093411a-c3d5-4b79-a341-7b70dbe35cfe",
  "id_veiculo": "16aba024-44bb-4e81-a348-1770e6bb953a",
  "id_cliente": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
  "status": "IN_PROGRESS",
  "descricao": "Revisao geral E2E",
  "valor_total_servicos": "300.5",
  "valor_total_pecas": "199.5",
  "valor_total_geral": "500",
  "orcamento_status": "APPROVED",
  "orcamento_aprovado": true,
  "created_at": "2026-04-25T12:39:36.903Z",
  "updated_at": "2026-04-25T12:39:36.915Z",
  "entregue_em": null
}
```

### 8) Consultar OS final
Comando:
```bash
curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Authorization: Bearer <TOKEN>" -X GET "http://localhost:3000/api/v1/ordens-servico/0093411a-c3d5-4b79-a341-7b70dbe35cfe"
```
Status: 200
Resposta:
```json
{
  "id": "0093411a-c3d5-4b79-a341-7b70dbe35cfe",
  "id_veiculo": "16aba024-44bb-4e81-a348-1770e6bb953a",
  "id_cliente": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
  "status": "IN_PROGRESS",
  "descricao": "Revisao geral E2E",
  "valor_total_servicos": "300.5",
  "valor_total_pecas": "199.5",
  "valor_total_geral": "500",
  "orcamento_status": "APPROVED",
  "orcamento_aprovado": true,
  "created_at": "2026-04-25T12:39:36.903Z",
  "updated_at": "2026-04-25T12:39:36.915Z",
  "entregue_em": null,
  "veiculo": {
    "id": "16aba024-44bb-4e81-a348-1770e6bb953a",
    "placa": "ABC4D20",
    "marca": "Toyota",
    "modelo": "Corolla",
    "ano": 2020,
    "cor": "Preto",
    "id_cliente": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
    "created_at": "2026-04-25T12:39:36.898Z",
    "updated_at": "2026-04-25T12:39:36.898Z"
  },
  "cliente": {
    "id": "de9e3275-23dd-4859-8c09-b213ab2a77fe",
    "nome": "Cliente E2E 1777120776790",
    "email": "e2e.cliente.1777120776790@example.com",
    "telefone": "11999998888",
    "documento": "768.045.120-65",
    "tipo_documento": "CPF",
    "created_at": "2026-04-25T12:39:36.892Z",
    "updated_at": "2026-04-25T12:39:36.892Z"
  }
}
```

## Resumo

| Etapa | Status |
|---|---:|
| Registrar usuario | 201 |
| Login | 200 |
| Criar cliente | 201 |
| Criar veiculo | 201 |
| Criar ordem de servico | 201 |
| Gerar orcamento | 200 |
| Aprovar orcamento | 200 |
| Consultar OS final | 200 |

Estado final da OS:
- status: IN_PROGRESS
- orcamento_status: APPROVED
- orcamento_aprovado: true
- valor_total_servicos: 300.5
- valor_total_pecas: 199.5
- valor_total_geral: 500
