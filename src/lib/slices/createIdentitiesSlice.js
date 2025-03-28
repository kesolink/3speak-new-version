


export const createPostSlice = (set) => ({
    account: [],
    accounts: [],
    switch: async () => {
        const res = await fetch('url to switch account here')
        set({ account: await res.json() })
    },
    disconnect: async () => {
        const res = await fetch('url to disconnect account here')
        set({ accounts: await res.json() })
    },
})