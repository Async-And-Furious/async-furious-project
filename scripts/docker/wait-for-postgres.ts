import { execFile } from 'node:child_process';

function checkPostgres() {
  execFile(
    '/usr/bin/docker',
    ['exec', 'workshop-postgres', 'pg_isready', '--host', 'localhost'],
    handleReturn
  );

  function handleReturn(_error: Error | null, stdout: string) {
    if (stdout?.search('accepting connections') === -1) {
      process.stdout.write('.');
      checkPostgres();
      return;
    }

    process.stderr.write('\n\n🟢 Postgres está pronto e aceitando conexões!\n');
  }
}

console.log('\n\n🔴 Aguardando Postgres aceitar conexões');
checkPostgres();
