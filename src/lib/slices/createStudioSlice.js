

export const createStudioSlice = (set) => ({
  news: [
    {
      id: 1,
      title: "USDC, Silicon Valley Bank, Stable Coins - CTT",
      description: "author: spknetwork.chat",
    },
    {
      id: 2,
      title:
        "Introducing the Acela Core - Upgrading Existing Web2 Apps into True Web3 Dapps",
      description: "author: spknetwork.chat",
    },
    {
      id: 3,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
    {
      id: 4,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
    {
      id: 5,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
    {
      id: 6,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
    {
      id: 7,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
    {
      id: 8,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
    {
      id: 9,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
    {
      id: 10,
      title: "Multiparty State Channels - SPK Network Team Meeting",
      description: "author: spknetwork.chat",
    },
  ],
  video_count: 200,
  followers_count: 100,
  views_count: 100,
  fetchNews: async () => {
    const res = await fetch("url to switch account here");
    set({ news: await res.json() });
  },
});
