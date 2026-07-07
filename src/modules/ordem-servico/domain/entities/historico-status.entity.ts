import { OSStatus } from './ordem-servico.entity';

interface HistoricoStatusProps {
  id?: string;
  ordemServicoId: string;
  statusAnterior: OSStatus | null;
  statusNovo: OSStatus;
  motivo?: string | null;
  dataHora: Date;
}

export class HistoricoStatus {
  id?: string;
  ordemServicoId: string;
  statusAnterior: OSStatus | null;
  statusNovo: OSStatus;
  motivo: string | null;
  dataHora: Date;

  private constructor(props: HistoricoStatusProps) {
    this.id = props.id;
    this.ordemServicoId = props.ordemServicoId;
    this.statusAnterior = props.statusAnterior;
    this.statusNovo = props.statusNovo;
    this.motivo = props.motivo ?? null;
    this.dataHora = props.dataHora;
  }

  static create(props: Omit<HistoricoStatusProps, 'dataHora'> & { dataHora?: Date }): HistoricoStatus {
    return new HistoricoStatus({
      ...props,
      dataHora: props.dataHora ?? new Date(),
    });
  }
}
