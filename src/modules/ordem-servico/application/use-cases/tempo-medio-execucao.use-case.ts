import { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';

export class ConsultarTempoMedioExecucaoUseCase {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  async execute(): Promise<{ tempoMedioMinutos: number; totalOrdensConsideradas: number }> {
    const { totalMinutos, total } = await this.ordemServicoRepository.calcularTempoMedioExecucao();
    return {
      tempoMedioMinutos: total > 0 ? Math.round(totalMinutos / total) : 0,
      totalOrdensConsideradas: total,
    };
  }
}
