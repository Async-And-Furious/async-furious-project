import { exec } from 'node:child_process';

function checkPostgres() {
  exec('docker exec workshop-postgres pg_isready --host localhost', handleReturn);
  function handleReturn(_error, stdout) {
    //eslint-disable-next-line
    if (stdout?.search('accepting connections') === -1) {
      process.stdout.write('.');
      checkPostgres();
      return;
    }

    console.log('\n\n🟢 Postgres está pronto e aceitando conexões!\n');
  }
}

process.stdout.write('\n\n🔴 Aguardando Postgres aceitar conexões');
checkPostgres();
