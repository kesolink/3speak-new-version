import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'crypto', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      }
    })
  ],
  base: "/", // Ensure this is correct for Vercel deployment
  assetsInclude: ['**/*.mkv', '**/*.JPG'],
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util',
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    sourcemap: true,
  },
  optimizeDeps: {
    include: ["react-quilljs", "quill"], // 👈 Ensure Quill is included
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  css: {
    devSourcemap: true,
  },
  
});
