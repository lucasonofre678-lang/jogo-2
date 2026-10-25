import { defineConfig } from 'vite';

export default defineConfig({
  // caminhos relativos: o build roda em qualquer pasta (itch.io, GitHub Pages)
  base: './',
  server: { port: 5173, open: false },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Three.js num arquivo separado: o navegador guarda em cache entre versões
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
