-- Additive migration for tables present in prisma/schema.prisma but absent from the baseline.
CREATE TABLE "OsServico" (
    "id" TEXT NOT NULL,
    "id_ordem_servico" TEXT NOT NULL,
    "id_servico" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "preco_unitario" DECIMAL(10,2) NOT NULL,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OsServico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historico_status_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "status_anterior" "SOStatus",
    "status_novo" "SOStatus" NOT NULL,
    "motivo" TEXT,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historico_status_os_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OsServico_id_ordem_servico_id_servico_key"
  ON "OsServico"("id_ordem_servico", "id_servico");

ALTER TABLE "OsServico"
  ADD CONSTRAINT "OsServico_id_ordem_servico_fkey"
  FOREIGN KEY ("id_ordem_servico") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OsServico"
  ADD CONSTRAINT "OsServico_id_servico_fkey"
  FOREIGN KEY ("id_servico") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historico_status_os"
  ADD CONSTRAINT "historico_status_os_ordem_servico_id_fkey"
  FOREIGN KEY ("ordem_servico_id") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
