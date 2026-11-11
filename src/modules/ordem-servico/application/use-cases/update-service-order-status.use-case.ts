import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OSStatus, OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import { logOsStatusTransition } from '../logging/log-os-status-transition';
import type { IOSStatusTransitionLogger } from '../logging/log-os-status-transition';

// Valida a transição e grava pelo repository, que registra o histórico (com o
// motivo) na mesma transação e projeta no read model.
export class UpdateServiceOrderStatusUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissorEventos: IEmissorEventos,
    private readonly statusTransitionService: StatusTransitionService,
    private readonly transitionLogger: IOSStatusTransitionLogger
  ) {}

  async execute(osId: string, newStatus: OSStatus, motivo?: string): Promise<OrdemDeServico> {
    // 1. Busca a OS
    const os = await this.ordemServicoRepository.findOne(osId);
    if (!os) {
      throw new EntityNotFoundException('OrdemServico', osId);
    }

    const currentStatus = os.status;

    // 2. Valida a transição e pega o evento
    const event = this.statusTransitionService.validateAndGetEvent(os.id, currentStatus, newStatus);

    // 3. Atualiza o status
    os.status = newStatus;
    // (Pode ser necessário gravar a data de finalização ou outras coisas se for FINISHED)
    if (newStatus === 'FINISHED') os.finalizada_em = new Date();
    if (newStatus === 'DELIVERED') os.entregue_em = new Date();

    const updatedOs = await this.ordemServicoRepository.update(os.id, {
      status: newStatus,
      motivo,
      ...(newStatus === 'FINISHED' ? { finalizada_em: os.finalizada_em } : {}),
      ...(newStatus === 'DELIVERED' ? { entregue_em: os.entregue_em } : {}),
    });

    if (newStatus === 'FINISHED' || newStatus === 'CLOSED_WITHOUT_EXECUTION') {
      logOsStatusTransition(this.transitionLogger, currentStatus, newStatus);
    }

    // 4. Emite evento de domínio, se houver
    if (event) {
      await this.emissorEventos.emitir(event);
    }

    return updatedOs;
  }
}
