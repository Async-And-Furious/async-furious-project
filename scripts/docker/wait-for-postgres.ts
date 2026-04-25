import { Client } from 'pg';
import { existsSync, readFileSync } from 'node:fs';

const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 2000;

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function ensureDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return stripWrappingQuotes(process.env.DATABASE_URL);
  }

  const envPath = '.env';
  if (!existsSync(envPath)) {
    return undefined;
  }

  const content = readFileSync(envPath, 'utf8');
  const line = content
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('DATABASE_URL='));

  if (!line) {
    return undefined;
  }

  const rawValue = line.slice('DATABASE_URL='.length);
  const parsedValue = stripWrappingQuotes(rawValue);
  process.env.DATABASE_URL = parsedValue;
  return parsedValue;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnect(): Promise<boolean> {
  const connectionString = ensureDatabaseUrl();
  if (!connectionString) {
    return false;
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function waitForPostgres(): Promise<void> {
  process.stdout.write('\n\nAguardando Postgres aceitar conexoes');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const connected = await canConnect();

    if (connected) {
      console.log('\n\nPostgres esta pronto e aceitando conexoes!\n');
      return;
    }

    process.stdout.write('.');
    await sleep(RETRY_INTERVAL_MS);
  }

  console.error('\n\nNao foi possivel conectar ao Postgres dentro do tempo limite.');
  process.exit(1);
}

waitForPostgres().catch((error) => {
  console.error('Erro ao aguardar Postgres:', error);
  process.exit(1);
});
