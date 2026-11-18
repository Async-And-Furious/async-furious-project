import { DomainException } from './domain.exception';

// Regra de negócio violada pelo estado atual de outro recurso (HTTP 409).
export class ConflitoException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'ConflitoException';
  }
}
