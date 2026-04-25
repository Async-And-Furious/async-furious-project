import { Veiculo } from '../entities/veiculo.entity';

export interface VeiculoAdicionadoEventPayload {
  veiculoId: string;
  placa: string;
  marca: string;
  modelo: string;
  clienteId: string;
  dataAdicao: Date;
}

export class VeiculoAdicionadoEvent {
  readonly eventType = 'VEICULO_ADICIONADO';
  readonly occurredOn: Date;
  readonly payload: VeiculoAdicionadoEventPayload;

  constructor(veiculo: Veiculo) {
    this.occurredOn = new Date();
    this.payload = {
      veiculoId: veiculo.id,
      placa: veiculo.placa.formato,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      clienteId: veiculo.clienteId,
      dataAdicao: this.occurredOn,
    };
  }
}
