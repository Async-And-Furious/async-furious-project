-- Keep the oldest completion for each order. Losers are retained in an audit
-- table so this migration never silently discards an event identity/payload.
ALTER TABLE "SagaCompletion" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OUTBOX';

CREATE TABLE IF NOT EXISTS "SagaCompletionDeduplicationAudit" (
  "eventId" TEXT PRIMARY KEY,
  "ordemServicoId" TEXT NOT NULL,
  "compensacoes" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "keptEventId" TEXT NOT NULL,
  "deduplicatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH ranked AS (
  SELECT
    "eventId",
    "ordemServicoId",
    "compensacoes",
    "publishedAt",
    "createdAt",
    FIRST_VALUE("eventId") OVER (
      PARTITION BY "ordemServicoId"
      ORDER BY "createdAt", "eventId"
    ) AS "keptEventId",
    ROW_NUMBER() OVER (
      PARTITION BY "ordemServicoId"
      ORDER BY "createdAt", "eventId"
    ) AS row_number
  FROM "SagaCompletion"
)
INSERT INTO "SagaCompletionDeduplicationAudit" (
  "eventId", "ordemServicoId", "compensacoes", "publishedAt", "createdAt", "keptEventId"
)
SELECT "eventId", "ordemServicoId", "compensacoes", "publishedAt", "createdAt", "keptEventId"
FROM ranked
WHERE row_number > 1
ON CONFLICT ("eventId") DO NOTHING;

DELETE FROM "SagaCompletion" AS duplicate
USING "SagaCompletion" AS keeper
WHERE duplicate."ordemServicoId" = keeper."ordemServicoId"
  AND (duplicate."createdAt", duplicate."eventId") > (keeper."createdAt", keeper."eventId");

CREATE UNIQUE INDEX "SagaCompletion_ordemServicoId_key" ON "SagaCompletion"("ordemServicoId");
