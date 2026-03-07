import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAuthUserSlice } from './slices/createAuthStore';
import { createStudioSlice } from './slices/createStudioSlice';
import { createUserDetailsSlice } from './slices/createUserStore';
import { createVideoSlice } from './slices/createVideoSlice';
import {createPostProcessingSlice} from "./slices/createPostProcessingSlice"
import { createThemeSlice } from './slices/createThemeSlice';
import { createMiniPlayerSlice } from './slices/createMiniPlayerSlice';

export const useAppStore = create(
  persist(
    (...a) => ({
      ...createAuthUserSlice(...a),
      ...createStudioSlice(...a),
      ...createUserDetailsSlice(...a),
      ...createVideoSlice(...a),
      ...createPostProcessingSlice(...a),
      ...createThemeSlice(...a),
      ...createMiniPlayerSlice(...a),
      watchHistoryEnabled: true,
      setWatchHistoryEnabled: (enabled) => a[0]({ watchHistoryEnabled: enabled }),
      sidebarOpen: false,
      setSidebarOpen: (open) => a[0]({ sidebarOpen: typeof open === 'function' ? open(a[1]().sidebarOpen) : open }),
    }),
    {
      name: 'user-store', // The storage key for persisting user data
      partialize: (state) => ({
        user: state.user, // Persist only the `user` slice
        isProcessing: state.isProcessing,
        theme: state.theme, // Persist theme preference
        watchHistoryEnabled: state.watchHistoryEnabled,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
