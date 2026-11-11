// Importar este módulo ANTES do helper: o agente `newrelic` lê o ambiente ao ser carregado.
process.env.NEW_RELIC_ENABLED = 'false';
process.env.NEW_RELIC_NO_CONFIG_FILE = 'true';
process.env.NEW_RELIC_LICENSE_KEY = '';

export {};
