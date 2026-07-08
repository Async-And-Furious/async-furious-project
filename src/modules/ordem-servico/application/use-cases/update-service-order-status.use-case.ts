import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';

export class UpdateServiceOrderStatusUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly emissorEventos: IEmissorEventos,
    private readonly statusTransitionService: StatusTransitionService
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
      ...(newStatus === 'FINISHED' ? { finalizada_em: os.finalizada_em } : {}),
      ...(newStatus === 'DELIVERED' ? { entregue_em: os.entregue_em } : {}),
    });

    // 4. Salva o histórico
    const historico = HistoricoStatus.create({
      ordemServicoId: os.id,
      statusAnterior: currentStatus,
      statusNovo: newStatus,
      motivo,
    });
    await this.statusHistoryRepository.create(historico);

    // 5. Emite evento de domínio, se houver
    if (event) {
      await this.emissorEventos.emitir(event);
    }

    return updatedOs;
  }
}
