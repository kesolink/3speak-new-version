

export const createPostProcessingSlice = (set) => ({

    isProcessing : null,

    updateProcessing:(permlink)=>{
        set({isProcessing: permlink})
    }
    
})
