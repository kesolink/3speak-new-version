export const createMiniPlayerSlice = (set) => ({
  miniPlayer: null, // { author, permlink, title, thumbnail, currentTime, duration }
  setMiniPlayer: (data) => set({ miniPlayer: data }),
  clearMiniPlayer: () => set({ miniPlayer: null }),
});
