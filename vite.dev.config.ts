import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './examples',
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      'fireberry-api-client': resolve(__dirname, './src/index.ts'),
      'fireberry-api-client/sdk': resolve(__dirname, './src/sdk/index.ts'),
      'fireberry-api-client/utils': resolve(__dirname, './src/utils/index.ts'),
    },
  },
});
