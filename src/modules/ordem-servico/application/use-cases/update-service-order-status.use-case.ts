import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OSStatus, OrdemDeServico } from '../../domain/entities/ordem-servico.entity';

// Usado só pelo webhook de status (canal de reprocesso manual). A entrega tem
// caminho próprio (registrar-entrega), por isso DELIVERED é rejeitado aqui.
// Só valida a transição: histórico e projeção ficam no repository.
export class UpdateServiceOrderStatusUseCase {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissorEventos: IEmissorEventos,
    private readonly statusTransitionService: StatusTransitionService
  ) {}

  async execute(osId: string, newStatus: OSStatus, motivo?: string): Promise<OrdemDeServico> {
    if (newStatus === 'DELIVERED') {
      throw new DomainException(
        'A transição para DELIVERED não é permitida pelo webhook. Use o registro de entrega.'
      );
    }

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

    const updatedOs = await this.ordemServicoRepository.update(os.id, {
      status: newStatus,
      motivo,
      ...(newStatus === 'FINISHED' ? { finalizada_em: os.finalizada_em } : {}),
    });

    // 4. Emite evento de domínio, se houver
    if (event) {
      await this.emissorEventos.emitir(event);
    }

    return updatedOs;
  }
}
