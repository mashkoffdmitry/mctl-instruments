import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Demo app build → dist-demo/. Served by the proxy at /demo, so the base is
// /demo/ and Vue is bundled (not externalized).
export default defineConfig({
  base: '/demo/',
  plugins: [vue()],
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
});
