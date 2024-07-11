import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

const API_SERVER = 'http://localhost:8000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: API_SERVER,
        changeOrigin: true,
      },
      '/sockets': {
        target: API_SERVER,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
