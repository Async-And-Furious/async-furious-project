import { Logger } from '@nestjs/common';
import {
  READ_MODEL_FAILURE_EVENT,
  ReadModelFailureReporter,
} from '../../src/shared/infrastructure/read-model/read-model-failure.reporter';

describe('ReadModelFailureReporter', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('loga em nível de erro e emite o evento custom no New Relic', () => {
    const record = jest.fn();
    const error = new Error('DocumentDB indisponível');

    new ReadModelFailureReporter(record).report('os_read_model', 'os-1', error);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('os_read_model/os-1'),
      error.stack
    );
    expect(record).toHaveBeenCalledWith(READ_MODEL_FAILURE_EVENT, {
      collection: 'os_read_model',
      documentId: 'os-1',
      message: 'DocumentDB indisponível',
    });
  });

  it('não propaga falha do próprio relato', () => {
    const record = jest.fn(() => {
      throw new Error('agente fora do ar');
    });

    expect(() =>
      new ReadModelFailureReporter(record).report('cliente_read_model', 'c-1', 'erro')
    ).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('erro'), undefined);
  });

  it('funciona sem o agente do New Relic carregado', () => {
    expect(() =>
      new ReadModelFailureReporter(null).report('os_read_model', 'os-1', new Error('x'))
    ).not.toThrow();
  });
});
