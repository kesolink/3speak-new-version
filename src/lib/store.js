import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAuthUserSlice } from './slices/createAuthStore';
import { createStudioSlice } from './slices/createStudioSlice';
import { createUserDetailsSlice } from './slices/createUserStore';
import { createVideoSlice } from './slices/createVideoSlice';
import {createPostProcessingSlice} from "./slices/createPostProcessingSlice"
import { createThemeSlice } from './slices/createThemeSlice';
import { createMiniPlayerSlice } from './slices/createMiniPlayerSlice';
import { createAudioPlayerSlice } from './slices/createAudioPlayerSlice';

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
      ...createAudioPlayerSlice(...a),
      watchHistoryEnabled: true,
      setWatchHistoryEnabled: (enabled) => a[0]({ watchHistoryEnabled: enabled }),
      sidebarOpen: false,
      setSidebarOpen: (open) => a[0]({ sidebarOpen: typeof open === 'function' ? open(a[1]().sidebarOpen) : open }),
      // User preference: completely hide the persistent left sidebar (default true).
      // The hamburger drawer in the top bar still works regardless.
      sidebarHidden: true,
      setSidebarHidden: (val) => a[0]({ sidebarHidden: typeof val === 'function' ? val(a[1]().sidebarHidden) : val }),
      showNsfw: false,
      setShowNsfw: (val) => a[0]({ showNsfw: typeof val === 'function' ? val(a[1]().showNsfw) : val }),
    }),
    {
      name: 'user-store', // The storage key for persisting user data
      partialize: (state) => ({
        user: state.user, // Persist only the `user` slice
        isProcessing: state.isProcessing,
        theme: state.theme, // Persist theme preference
        watchHistoryEnabled: state.watchHistoryEnabled,
        sidebarOpen: state.sidebarOpen,
        sidebarHidden: state.sidebarHidden,
        showNsfw: state.showNsfw,
      }),
    }
  )
);
