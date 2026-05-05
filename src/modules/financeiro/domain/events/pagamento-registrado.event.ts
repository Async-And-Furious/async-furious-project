import { randomUUID } from 'crypto';
// Caso exista uma interface DomainEvent no seu shared, você pode importá-la e usar 'implements DomainEvent'

export class PagamentoRegistradoEvent {
  // Propriedades exigidas pelo contrato do EmissorEventos
  public readonly eventId: string;
  public readonly ocorridoEm: Date;

  constructor(
    public readonly pagamentoId: string,
    public readonly ordemServicoId: string
  ) {
    // Geramos o ID do evento e a data no momento em que a classe é instanciada
    this.eventId = randomUUID();
    this.ocorridoEm = new Date();
  }
}
