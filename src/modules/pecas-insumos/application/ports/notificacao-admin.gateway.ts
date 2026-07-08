export interface NotificacaoAdminPayload {
  ordemServicoId: string;
  idsPecasIndisponiveis: string[];
}

export interface INotificacaoAdminGateway {
  alertar(payload: NotificacaoAdminPayload): Promise<void>;
}

export const NOTIFICACAO_ADMIN_GATEWAY = Symbol('NOTIFICACAO_ADMIN_GATEWAY');
