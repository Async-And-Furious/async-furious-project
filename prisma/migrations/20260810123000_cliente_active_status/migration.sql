-- Additive customer status used by the external CPF authentication flow.
ALTER TABLE "Cliente"
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
