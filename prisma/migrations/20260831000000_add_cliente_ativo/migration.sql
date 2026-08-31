-- Additive, backward-safe customer status field. Existing rows become active.
ALTER TABLE "Cliente" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
