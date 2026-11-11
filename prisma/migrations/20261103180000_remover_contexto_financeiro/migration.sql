-- Extração do contexto Financeiro (#330): orçamento, pagamento e idempotência do webhook do
-- Mercado Pago passam a ser do Billing Service, com banco próprio (sem ETL: o Billing nasce vazio).
-- Destrutiva: os dados destas tabelas no banco do OS Service são descartados.
-- DROP TABLE leva junto a FK Orcamento -> OrdemServico (onDelete: Cascade), a única que cruzava a
-- fronteira; o Billing referencia a OS só por id.
DROP TABLE IF EXISTS "Orcamento";
DROP TABLE IF EXISTS "pagamentos";
DROP TABLE IF EXISTS "webhook_recebido";
DROP TYPE IF EXISTS "EstimateStatus";
