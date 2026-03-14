import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
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
        devOptions: { enabled: true },
        manifest: {
          name: "3Speak",
          short_name: "3Speak",
          description: "3Speak - Decentralized Video Platform",
          theme_color: "#1a1a2e",
          background_color: "#1a1a2e",
          display: "standalone",
          start_url: "/",
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
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/hivesigner\.html/],
          globPatterns: ["**/*.html"],
          runtimeCaching: [
            {
              urlPattern: /\.(?:js|css|woff2?)$/i,
              handler: "StaleWhileRevalidate",
              options: { cacheName: "static-assets" },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
          ],
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
      allowedHosts: ["3speak.okinoko.io"],
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
        // Proxy RSS feed XML requests to the checker-server (localhost:3000)
        // We use a regex to ONLY proxy .xml files, so .xsl can be served from /public/rss
        '^/rss/.*\\.xml$': {
          target: env.VITE_RSS_BASE_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path, // keep the path as is
        },
      },
    },
  };
});