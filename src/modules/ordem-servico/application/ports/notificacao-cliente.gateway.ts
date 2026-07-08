export interface NotificacaoClientePayload {
  ordemServicoId: string;
  mensagem: string;
}

export interface INotificacaoClienteGateway {
  notificar(payload: NotificacaoClientePayload): Promise<void>;
}

export const NOTIFICACAO_CLIENTE_GATEWAY = Symbol('NOTIFICACAO_CLIENTE_GATEWAY');
