import { randomUUID } from 'node:crypto';

export abstract class DomainEvent {
  readonly ocorridoEm: Date;
  readonly eventId: string;

  constructor(eventId: string = randomUUID()) {
    this.ocorridoEm = new Date();
    this.eventId = eventId;
  }
}
