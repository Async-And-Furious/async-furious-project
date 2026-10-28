-- Reserva de peças pendente (#334): a OS permanece em AWAITING_APPROVAL até ExecucaoIniciada;
-- o marcador decide se ela segue para AWAITING_PARTS logo após IN_PROGRESS.
ALTER TABLE "OrdemServico" ADD COLUMN IF NOT EXISTS "reserva_pecas_pendente" BOOLEAN NOT NULL DEFAULT false;
