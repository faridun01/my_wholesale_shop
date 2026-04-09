import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.OCR_API_KEY': JSON.stringify(env.OCR_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
                return 'pdf-vendor';
              }

              if (id.includes('xlsx')) {
                return 'spreadsheet-vendor';
              }

              if (id.includes('recharts') || id.includes('d3-')) {
                return 'charts-vendor';
              }

              if (id.includes('react-router')) {
                return 'router-vendor';
              }

              if (id.includes('react-dom') || id.includes('react')) {
                return 'react-vendor';
              }
            }

            return undefined;
          },
        },
      },
    },
    server: {
      // HMR can be disabled via DISABLE_HMR env var.
      // File watching may be disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
