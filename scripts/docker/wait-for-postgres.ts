import { exec } from 'node:child_process';
const DOCKER_CMD = '/usr/bin/docker';

function checkPostgres() {
  const cmd = `${DOCKER_CMD} exec workshop-postgres pg_isready --host localhost`;
  exec(cmd, handleReturn);

  function handleReturn(_error: Error | null, stdout: string) {
    if (stdout?.search('accepting connections') === -1) {
      process.stdout.write('.');
      checkPostgres();
      return;
    }

    console.log('\n\n🟢 Postgres está pronto e aceitando conexões!\n');
  }
}

console.log('\n\n🔴 Aguardando Postgres aceitar conexões');
checkPostgres();
