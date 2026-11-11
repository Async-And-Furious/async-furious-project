import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DetectorOsParadaModule } from './modules/ordem-servico/detector-os-parada.module';
import { DetectarOsParadaUseCase } from './modules/ordem-servico/application/use-cases/detectar-os-parada.use-case';

/**
 * Ponto de entrada do CronJob `detector-os-parada` (k8s/app/detector-os-parada-cronjob.yaml).
 * Roda uma varredura e sai: código 1 se alguma OS falhou, para o Job aparecer como falho.
 */
async function executar(): Promise<void> {
  const app = await NestFactory.createApplicationContext(DetectorOsParadaModule);
  try {
    const { falhas } = await app.get(DetectarOsParadaUseCase).executar();
    process.exitCode = falhas > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

executar().catch((erro: unknown) => {
  new Logger('DetectorOsParada').error(
    `Detector de OS parada falhou: ${erro instanceof Error ? erro.message : String(erro)}`
  );
  process.exitCode = 1;
});
