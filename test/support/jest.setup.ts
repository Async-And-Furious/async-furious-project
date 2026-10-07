// Keep unit/coverage runs independent from developer or CI shell configuration.
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/workshop';
