import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAuthUserSlice } from './slices/createAuthStore';
import { createStudioSlice } from './slices/createStudioSlice';
import { createUserDetailsSlice } from './slices/createUserStore';
import { createVideoSlice } from './slices/createVideoSlice';
import {createPostProcessingSlice} from "./slices/createPostProcessingSlice"

export const useAppStore = create(
  persist(
    (...a) => ({
      ...createAuthUserSlice(...a),
      ...createStudioSlice(...a),
      ...createUserDetailsSlice(...a),
      ...createVideoSlice(...a),
      ...createPostProcessingSlice(...a)
    }),
    {
      name: 'user-store', // The storage key for persisting user data
      partialize: (state) => ({
        user: state.user, // Persist only the `user` slice
        isProcessing: state.isProcessing,
      }),
    }
  )
);
