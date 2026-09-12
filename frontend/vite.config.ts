import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Only react/react-dom/react-router-dom belong here — they're needed on
        // every page, so hoisting them into one cacheable vendor chunk is correct.
        // recharts and jspdf must NOT be listed here: manualChunks entries are
        // treated as always-needed and get <link rel="modulepreload"> injected
        // into the root index.html, forcing every visitor to download both
        // (~840KB, measured 2.8-3.3s each on the production server) before the
        // app even renders — even though both libraries are only ever used
        // inside already lazy-loaded routes (Reports charts, invoice/report
        // printing). Leaving them out lets Rollup's normal dynamic-import
        // splitting keep them in their own chunk, fetched only when that route
        // actually runs.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
