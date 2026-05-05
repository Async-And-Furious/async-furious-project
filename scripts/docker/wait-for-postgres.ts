import { execFile } from 'node:child_process';

function checkPostgres() {
  execFile(
    'docker',
    ['exec', 'workshop-postgres', 'pg_isready', '--host', 'localhost'],
    handleReturn
  );

  function handleReturn(error: Error | null, stdout: string, stderr: string) {
    if (error || stdout?.search('accepting connections') === -1) {
      if (error) {
        process.stdout.write(`\n${String(error.message || error)}\n`);
      }
      if (stderr) {
        process.stdout.write(`${stderr}\n`);
      }
      process.stdout.write('.');
      setTimeout(checkPostgres, 1000);
      return;
    }

    process.stderr.write('\n\n🟢 Postgres está pronto e aceitando conexões!\n');
  }
}

console.log('\n\n🔴 Aguardando Postgres aceitar conexões');
checkPostgres();
