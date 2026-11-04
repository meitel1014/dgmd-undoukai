import { defineConfig } from 'vitest/config';
import path from 'node:path';

// vite.config.mts は NodeCG のビルドプラグインを読み込むため、テストでは使わない。
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
