import { Injectable, Logger } from '@nestjs/common';
import type {
  IFornecedorGateway,
  EnviarPedidoFornecedorPayload,
} from '../../application/ports/fornecedor.gateway';

@Injectable()
export class FornecedorStub implements IFornecedorGateway {
  private readonly logger = new Logger(FornecedorStub.name);

  async enviarPedido(payload: EnviarPedidoFornecedorPayload): Promise<void> {
    this.logger.log(
      `[STUB] Pedido ${payload.pedidoId} enviado ao fornecedor ${payload.fornecedorId} — ${payload.itens.length} item(ns).`
    );
  }
}
