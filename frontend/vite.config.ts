import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // A jsdom render plus Testing Library's `findBy*` polling takes far more
    // than the 5 s default on a cold Windows filesystem (measured: 1-5 s per
    // test), which made the suite fail by timeout instead of by assertion. The
    // budget is a machine-speed guard, not a behavioural one: a real regression
    // still fails, it just stops being reported as a timeout.
    testTimeout: 45000,
    hookTimeout: 45000,
  },
});
