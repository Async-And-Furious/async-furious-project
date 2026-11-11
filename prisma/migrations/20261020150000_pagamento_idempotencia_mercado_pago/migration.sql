-- Idempotência da integração com o Mercado Pago (#325).
-- ATENÇÃO: o índice único em "ordemServicoId" falha se já existir mais de um pagamento para a mesma OS
-- (POST /pagamentos/registrar permitia). Conferir antes do deploy:
--   SELECT "ordemServicoId", count(*) FROM "pagamentos" GROUP BY 1 HAVING count(*) > 1;

-- DropIndex
DROP INDEX IF EXISTS "pagamentos_ordemServicoId_idx";

-- AlterTable
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "mercado_pago_payment_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "webhook_recebido" (
    "id" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_recebido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_recebido_provider_event_id_tipo_key" ON "webhook_recebido"("provider_event_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pagamentos_ordemServicoId_key" ON "pagamentos"("ordemServicoId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pagamentos_mercado_pago_payment_id_key" ON "pagamentos"("mercado_pago_payment_id");
