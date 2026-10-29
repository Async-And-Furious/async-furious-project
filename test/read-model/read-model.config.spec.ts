import { resolveReadModelConnection } from '../../src/shared/infrastructure/read-model/read-model.config';

describe('resolveReadModelConnection', () => {
  it('usa DOCDB_URI quando informada (local e CI com container mongo)', () => {
    const conn = resolveReadModelConnection({ DOCDB_URI: 'mongodb://mongo:27017' });

    expect(conn).toEqual({
      uri: 'mongodb://mongo:27017',
      database: 'os_read_model',
      options: { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 },
    });
  });

  it('monta a URI do DocumentDB a partir do secret com TLS, rs0 e sem retryable writes', () => {
    const conn = resolveReadModelConnection({
      DOCDB_HOST: 'tc3-docdb-hml.cluster.local',
      DOCDB_PORT: '27017',
      DOCDB_USER: 'master',
      DOCDB_PASSWORD: 'p@ss:word',
      DOCDB_NAME: 'os_read_model',
    });

    expect(conn.uri).toBe('mongodb://master:p%40ss%3Aword@tc3-docdb-hml.cluster.local:27017/');
    expect(conn.database).toBe('os_read_model');
    expect(conn.options).toEqual({
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      tls: true,
      tlsCAFile: '/app/certs/global-bundle.pem',
      replicaSet: 'rs0',
      readPreference: 'secondaryPreferred',
      retryWrites: false,
    });
  });

  it('permite trocar o CA bundle e assume a porta padrão', () => {
    const conn = resolveReadModelConnection({
      DOCDB_HOST: 'h',
      DOCDB_USER: 'u',
      DOCDB_PASSWORD: 'p',
      DOCDB_TLS_CA_FILE: '/tmp/ca.pem',
    });

    expect(conn.uri).toBe('mongodb://u:p@h:27017/');
    expect(conn.options.tlsCAFile).toBe('/tmp/ca.pem');
  });

  it('cai no mongo local fora de produção quando nada está configurado', () => {
    expect(resolveReadModelConnection({ NODE_ENV: 'test' }).uri).toBe('mongodb://localhost:27017');
  });

  it('exige configuração em produção', () => {
    expect(() => resolveReadModelConnection({ NODE_ENV: 'production' })).toThrow(
      'Read model sem configuração'
    );
  });
});
