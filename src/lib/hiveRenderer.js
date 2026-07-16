// Shared, lazy-loaded Hive markdown → HTML renderer (same config MarkdownComposer and
// BlogContent use). createHiveRenderer returns a synchronous render(md) function; we
// memoise the dynamic import so the ~renderer bundle loads once, on first use.
let rendererPromise = null;

export function getHiveRenderer() {
  if (!rendererPromise) {
    rendererPromise = import('@snapie/renderer').then(({ createHiveRenderer }) =>
      createHiveRenderer({
        ipfsGateway: 'https://hotipfs-3speak-1.b-cdn.net',
        ipfsFallbackGateways: [
          'https://ipfs.skatehive.app',
          'https://cloudflare-ipfs.com',
          'https://ipfs.io',
        ],
        convertHiveUrls: true,
        internalUrlPrefix: '',
        usertagUrlFn: (account) => `/p/${account}`,
        hashtagUrlFn: (tag) => `/t/${tag}`,
      }),
    );
  }
  return rendererPromise;
}
