

export const createVideoSlice = (set) => ({
    video: null,
    setVideo: async (video) => {
        set({ video: video })
    },
})