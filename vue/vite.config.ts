import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { fileURLToPath } from 'node:url';

// Library build → dist/ (the npm package). Vue is externalized.
export default defineConfig({
  plugins: [vue(), dts({ rollupTypes: true, include: ['src'] })],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'MctlInstrumentsVue',
      fileName: (format) => (format === 'es' ? 'instruments-vue.mjs' : 'instruments-vue.umd.cjs'),
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue'],
      output: { globals: { vue: 'Vue' }, assetFileNames: 'instruments-vue.[ext]' },
    },
  },
});
