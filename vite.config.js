import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Include all modules needed by keychain-sdk and hive crypto libraries
      include: [
        "buffer",
        "stream",
        "crypto",
        "util",
        "process",
        "querystring",
        "events",
        "string_decoder",
        // Add common node modules used by renderers/libs that need browser polyfills
        "os",
        "path",
        "url",
        "source-map-js",
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Use polyfills even in dev mode
      protocolImports: true,
      // Override to ensure proper Buffer implementation
      overrides: {
        fs: "memfs",
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: {
        name: "3Speak",
        short_name: "3Speak",
        description: "3Speak - Decentralized Video Platform",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        categories: ["video", "social", "entertainment"],
        shortcuts: [
          {
            name: "Shorts",
            short_name: "Shorts",
            url: "/shorts",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Discover",
            short_name: "Discover",
            url: "/discover",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Upload Video",
            short_name: "Upload",
            url: "/studio",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Upload Short",
            short_name: "Short",
            url: "/embed-studio?from=shorts",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Shorts Editor",
            short_name: "Editor",
            url: "/embed-studio",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
        ],
        file_handlers: [
          {
            action: "/studio",
            accept: {
              "video/mp4": [".mp4"],
              "video/webm": [".webm"],
              "video/quicktime": [".mov"],
              "video/x-matroska": [".mkv"],
              "video/avi": [".avi"],
            },
          },
          {
            action: "/embed-studio",
            accept: {
              "video/mp4": [".mp4"],
              "video/webm": [".webm"],
              "video/quicktime": [".mov"],
            },
          },
        ],
        share_target: {
          action: "/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [
              {
                name: "video",
                accept: ["video/mp4", "video/webm", "video/quicktime", "video/*"],
              },
            ],
          },
        },
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{html,js,css,svg}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],

  define: {
    "process.env": {},
    global: "globalThis",
  },

  resolve: {
    alias: {
      // Ensure browser-compatible versions of Node.js modules
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      util: "util/",
      querystring: "querystring-es3",
      // Force readable-stream to use the polyfilled buffer
      buffer: "buffer",
      // Browser polyfills for node core modules
      path: "path-browserify",
      os: "os-browserify/browser",
      url: "url",
      'source-map-js': 'source-map-js',
    },
    // Enforce a single React instance across the whole graph. Without this,
    // dynamic imports + lazy chunks can resolve through a different React
    // instance than the renderer, causing "Invalid hook call: dispatcher is
    // null" errors when a lazy-loaded component first mounts.
    dedupe: ['react', 'react-dom', '@livekit/components-react', 'livekit-client'],
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      // ❌ REMOVED Buffer inject (this caused duplicate declaration)
    },
    include: [
      "buffer",
      "react-quilljs",
      "quill",
      "qrcode.react",
      "hive-auth-wrapper",
      "keychain-sdk",
      "readable-stream",
      // ensure these deps are pre-bundled
      "path-browserify",
      "os-browserify",
      "source-map-js",
      "url",
    ],
    exclude: ["@metamask/providers", "web3"],
  },

  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  css: {
    devSourcemap: true,
  },

  server: {
    allowedHosts: ["3speak.okinoko.io", "preview.3speak.tv"],
    proxy: {
      // Proxy upload API calls to video.3speak.tv to avoid CORS issues in dev.
      // In production, VITE_UPLOAD_URL should point directly to video.3speak.tv.
      '/upload-api': {
        target: 'https://video.3speak.tv',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/upload-api/, ''),
        configure: (proxy) => {
          // Strip Origin header so video.3speak.tv doesn't reject the request
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
          // Rewrite Location headers (TUS protocol returns absolute URLs)
          // so the TUS client continues through the proxy
          proxy.on('proxyRes', (proxyRes) => {
            const location = proxyRes.headers['location'];
            if (location && location.includes('video.3speak.tv')) {
              proxyRes.headers['location'] = location.replace(
                /https?:\/\/video\.3speak\.tv/,
                '/upload-api'
              );
            }
          });
        },
      },
      // Proxy image upload to images.3speak.tv to avoid CORS in dev.
      '/image-api': {
        target: 'https://images.3speak.tv',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/image-api/, ''),
      },
      // Snapie chat API (@snapie/chat-client). Same-origin proxy:
      // /snapie-chat/api/chat/* -> https://prod-snapie.okinoko.io/api/chat/*.
      // Points at LOCAL prod-snapie (which carries the delegated-verify patch so
      // background @threespeak chat signing works); snapie.io doesn't have it yet.
      '/snapie-chat': {
        target: 'https://prod-snapie.okinoko.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/snapie-chat/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
  },
});