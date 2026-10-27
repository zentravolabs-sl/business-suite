require('dotenv').config();
require('ts-node').register({
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' }
});
require('./apply-triggers.ts');
