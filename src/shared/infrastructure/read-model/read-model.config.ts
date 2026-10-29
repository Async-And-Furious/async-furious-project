import type { MongoClientOptions } from 'mongodb';

export const READ_MODEL_DB = Symbol('READ_MODEL_DB');
export const READ_MODEL_CLIENT = Symbol('READ_MODEL_CLIENT');

export const OS_READ_MODEL_COLLECTION = 'os_read_model';
export const CLIENTE_READ_MODEL_COLLECTION = 'cliente_read_model';
export const FILA_PRIORIDADE_INDEX = 'fila_prioridade_createdAt_id';

const DEFAULT_DATABASE = 'os_read_model';
const DEFAULT_CA_FILE = '/app/certs/global-bundle.pem';
const LOCAL_URI = 'mongodb://localhost:27017';

export interface ReadModelConnection {
  uri: string;
  database: string;
  options: MongoClientOptions;
}

// Local e CI usam DOCDB_URI (container mongo). Em HML/PROD a URI é montada a
// partir do secret tc3-docdb-os-<env> materializado como DOCDB_* no namespace,
// com os parâmetros exigidos pelo DocumentDB (TLS, rs0, sem retryable writes).
export function resolveReadModelConnection(env: NodeJS.ProcessEnv): ReadModelConnection {
  const database = env.DOCDB_NAME || DEFAULT_DATABASE;
  const options: MongoClientOptions = { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 };

  if (env.DOCDB_URI) {
    return { uri: env.DOCDB_URI, database, options };
  }

  const { DOCDB_HOST, DOCDB_PORT, DOCDB_USER, DOCDB_PASSWORD } = env;
  if (!DOCDB_HOST || !DOCDB_USER || !DOCDB_PASSWORD) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Read model sem configuração: defina DOCDB_URI ou DOCDB_HOST/USER/PASSWORD');
    }
    return { uri: LOCAL_URI, database, options };
  }

  const credentials = `${encodeURIComponent(DOCDB_USER)}:${encodeURIComponent(DOCDB_PASSWORD)}`;
  const uri = `mongodb://${credentials}@${DOCDB_HOST}:${DOCDB_PORT || '27017'}/`;
  return {
    uri,
    database,
    options: {
      ...options,
      tls: true,
      tlsCAFile: env.DOCDB_TLS_CA_FILE || DEFAULT_CA_FILE,
      replicaSet: 'rs0',
      readPreference: 'secondaryPreferred',
      retryWrites: false,
    },
  };
}
