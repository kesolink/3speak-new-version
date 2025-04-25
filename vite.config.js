import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "stream", "crypto", "util", "process", "querystring"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    "process.env": {},
    global: "globalThis", // Ensures `global` is available
  },
  resolve: {
    alias: {
      // Ensure browser-compatible versions of Node.js modules
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      util: "util/",
      querystring: "querystring-es3",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis", // Fixes global scope issues
      },
    },
    include: ["react-quilljs", "quill"], // Explicitly optimize these deps
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true, // Helps with CJS/ESM interop
    },
  },
});
