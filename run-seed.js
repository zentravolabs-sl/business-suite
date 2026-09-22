// Seed runner for Windows compatibility
require('ts-node').register({
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' }
});
require('./prisma/seed.ts');
