-- Pagamento confirmado pelo Billing (#331): PagamentoConfirmado grava pago_em sem mudar o status.
-- O detector de OS parada varre só OS em AWAITING_APPROVAL com pago_em nulo (ADR-0018).
ALTER TABLE "OrdemServico" ADD COLUMN IF NOT EXISTS "pago_em" TIMESTAMP(3);
