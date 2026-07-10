-- CreateEnum
CREATE TYPE "TaxIdType" AS ENUM ('CPF', 'CNPJ');

-- CreateEnum
CREATE TYPE "SOStatus" AS ENUM ('RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_PROGRESS', 'AWAITING_PARTS', 'FINISHED', 'DELIVERED', 'CLOSED_WITHOUT_EXECUTION');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "documento" TEXT NOT NULL,
    "tipo_documento" "TaxIdType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veiculo" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_cliente" TEXT NOT NULL,

    CONSTRAINT "Veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL,
    "id_veiculo" TEXT NOT NULL,
    "id_cliente" TEXT NOT NULL,
    "status" "SOStatus" NOT NULL DEFAULT 'RECEIVED',
    "descricao" TEXT,
    "iniciada_em" TIMESTAMP(3),
    "finalizada_em" TIMESTAMP(3),
    "entregue_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "id_ordem_servico" TEXT NOT NULL,
    "valor_total_servicos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_total_pecas" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_total_geral" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "EstimateStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Peca" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "quantidade_estoque" INTEGER NOT NULL DEFAULT 0,
    "quantidade_minima" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Peca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsPeca" (
    "id" TEXT NOT NULL,
    "id_ordem_servico" TEXT NOT NULL,
    "id_peca" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OsPeca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoFornecedor" (
    "id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoFornecedorItem" (
    "id" TEXT NOT NULL,
    "id_pedido_fornecedor" TEXT NOT NULL,
    "id_peca" TEXT NOT NULL,
    "quantidade_solicitada" INTEGER NOT NULL,
    "quantidade_recebida" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PedidoFornecedorItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaEstoque" (
    "id" TEXT NOT NULL,
    "ordem_id" TEXT NOT NULL,
    "peca_id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "reservado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservaEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_email_key" ON "Cliente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_documento_key" ON "Cliente"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Veiculo_placa_key" ON "Veiculo"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_id_ordem_servico_key" ON "Orcamento"("id_ordem_servico");

-- CreateIndex
CREATE UNIQUE INDEX "Peca_codigo_key" ON "Peca"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "OsPeca_id_ordem_servico_id_peca_key" ON "OsPeca"("id_ordem_servico", "id_peca");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaEstoque_ordem_id_peca_id_key" ON "ReservaEstoque"("ordem_id", "peca_id");

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_id_veiculo_fkey" FOREIGN KEY ("id_veiculo") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_id_ordem_servico_fkey" FOREIGN KEY ("id_ordem_servico") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsPeca" ADD CONSTRAINT "OsPeca_id_ordem_servico_fkey" FOREIGN KEY ("id_ordem_servico") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsPeca" ADD CONSTRAINT "OsPeca_id_peca_fkey" FOREIGN KEY ("id_peca") REFERENCES "Peca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoFornecedorItem" ADD CONSTRAINT "PedidoFornecedorItem_id_pedido_fornecedor_fkey" FOREIGN KEY ("id_pedido_fornecedor") REFERENCES "PedidoFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoFornecedorItem" ADD CONSTRAINT "PedidoFornecedorItem_id_peca_fkey" FOREIGN KEY ("id_peca") REFERENCES "Peca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
