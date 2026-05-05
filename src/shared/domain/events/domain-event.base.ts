import { randomUUID } from 'node:crypto';

export abstract class DomainEvent {
  readonly ocorridoEm: Date;
  readonly eventId: string;

  constructor() {
    this.ocorridoEm = new Date();
    this.eventId = randomUUID();
  }
}
