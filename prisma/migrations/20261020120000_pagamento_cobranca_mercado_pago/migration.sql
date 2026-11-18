-- Additive: Checkout Pro charge data (preference id + payment link) on pagamentos.
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "preference_id" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "link_pagamento" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pagamentos_ordemServicoId_idx" ON "pagamentos"("ordemServicoId");
