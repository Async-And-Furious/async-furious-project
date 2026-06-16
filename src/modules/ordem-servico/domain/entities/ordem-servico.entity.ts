import type { Orcamento } from './orcamento.entity';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

export type OSStatus =
  | 'RECEIVED'
  | 'UNDER_DIAGNOSIS'
  | 'AWAITING_APPROVAL'
  | 'IN_PROGRESS'
  | 'AWAITING_PARTS'
  | 'FINISHED'
  | 'DELIVERED'
  | 'CLOSED_WITHOUT_EXECUTION';

export class OrdemDeServico {
  id: string;
  veiculoId: string;
  clienteId: string;
  status: OSStatus;
  descricao: string | null;
  iniciada_em: Date | null;
  finalizada_em: Date | null;
  entregue_em: Date | null;
  created_at: Date;
  updated_at: Date;
  orcamento?: Orcamento;

  podeAssumir(): void {
    if (this.status !== 'RECEIVED') {
      throw new DomainException(
        `OS deve estar no status Recebida para ser assumida. Status atual: ${this.status}`
      );
    }
  }

  podeAnalisarVeiculo(): void {
    if (this.status !== 'UNDER_DIAGNOSIS') {
      throw new DomainException(
        `OS deve estar Em Diagnóstico para analisar o veículo. Status atual: ${this.status}`
      );
    }
  }

  podeLancarServicosInsumos(): void {
    if (!['UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'].includes(this.status)) {
      throw new DomainException(
        `OS deve estar Em Diagnóstico ou Aguardando Aprovação. Status atual: ${this.status}`
      );
    }
  }

  podeAtualizar(): void {
    if (!['RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'].includes(this.status)) {
      throw new DomainException(
        `A ordem de serviço só pode ser atualizada até Aguardando Aprovação. Status atual: ${this.status}`
      );
    }
  }

  podeFinalizar(): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new DomainException(
        `OS deve estar Em Execução para ser finalizada. Status atual: ${this.status}`
      );
    }
  }

  podeAprovarServico(): void {
    if (this.status !== 'FINISHED') {
      throw new DomainException(
        `OS deve estar Finalizada para aprovação do serviço pelo cliente. Status atual: ${this.status}`
      );
    }
  }

  podeRegistrarEntrega(): void {
    if (this.status !== 'FINISHED') {
      throw new DomainException(
        `OS deve estar Finalizada para registrar a entrega. Status atual: ${this.status}`
      );
    }
  }

  podeAprovarOuRecusarOrcamento(): void {
    if (this.status !== 'AWAITING_APPROVAL') {
      throw new DomainException(
        `OS deve estar em Aguardando Aprovação para aprovar ou recusar o orçamento. Status atual: ${this.status}`
      );
    }
  }
}
