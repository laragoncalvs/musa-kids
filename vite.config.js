import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/piano-simulator/',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'game.html'),
        selector: resolve(__dirname, 'selector.html'),
        tempos: resolve(__dirname, 'tempos.html'),
        demonstracao: resolve(__dirname, 'video-demonstracao.html'),
        results: resolve(__dirname, 'results.html'),
      },
    },
  },
});
