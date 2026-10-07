CREATE TABLE "RefundOperation" (
    "paymentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RefundOperation_pkey" PRIMARY KEY ("paymentId")
);
CREATE UNIQUE INDEX "RefundOperation_idempotencyKey_key" ON "RefundOperation"("idempotencyKey");
ALTER TABLE "RefundOperation" ADD CONSTRAINT "RefundOperation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "pagamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SagaEventReceipt" (
    "eventId" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "evidence" TEXT,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SagaEventReceipt_pkey" PRIMARY KEY ("eventId")
);
CREATE TABLE "SagaCompletion" (
    "ordemServicoId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "compensacoes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SagaCompletion_pkey" PRIMARY KEY ("ordemServicoId")
);
CREATE UNIQUE INDEX "SagaCompletion_eventId_key" ON "SagaCompletion"("eventId");
