

export const createPostSlice = (set) => ({
    post: [
        {
            id: 1,
            thumbnail: "https://ipfs-3speak.b-cdn.net/ipfs/bafybeibqxbf652lmfbdf7zoht3pbhkx4m76agdwn5mnw33vjhlxrzvccoe/",
            status: "DELETED",
        },
        {
            id: 2,
            thumbnail: "https://ipfs-3speak.b-cdn.net/ipfs/bafybeibqxbf652lmfbdf7zoht3pbhkx4m76agdwn5mnw33vjhlxrzvccoe/",
            status: "ACTIVE",
        },
        {
            id: 3,
            thumbnail: "https://ipfs-3speak.b-cdn.net/ipfs/bafybeibqxbf652lmfbdf7zoht3pbhkx4m76agdwn5mnw33vjhlxrzvccoe/",
            status: "NEW",
        }
    ],
   
    fetchPosts: async () => {
        const res = await fetch('url to fetching post here')
        set({ post: await res.json() })
    },
})
