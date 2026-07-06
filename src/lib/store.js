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
      // Video card size: 'small' | 'large' (default large). Drives home, profile
      // and playlist card grids.
      homeCardSize: 'large',
      setHomeCardSize: (val) => a[0]({ homeCardSize: typeof val === 'function' ? val(a[1]().homeCardSize) : val }),
      // Hover/scroll video previews on cards (default on).
      previewEnabled: true,
      setPreviewEnabled: (val) => a[0]({ previewEnabled: typeof val === 'function' ? val(a[1]().previewEnabled) : val }),
      // Selected content interests (ids from utils/interests.js). Canonical copy
      // lives in the user's Hive posting_json_metadata; this is a local cache for
      // instant UI, hydrated from Hive on load. Used later to bias served content.
      interests: [],
      setInterests: (val) => a[0]({ interests: typeof val === 'function' ? val(a[1]().interests) : val }),
      // Hide videos the user has already watched from discovery feeds (default off).
      hideWatched: false,
      setHideWatched: (val) => a[0]({ hideWatched: typeof val === 'function' ? val(a[1]().hideWatched) : val }),
      // Set on startup to the previous app version when the user upgraded (null = first
      // visit or no change). A future changelog / "what's new" prompt reads this.
      // Deliberately NOT persisted — recomputed each load by checkAppVersion().
      appUpdatedFrom: null,
      setAppUpdatedFrom: (v) => a[0]({ appUpdatedFrom: v }),
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
        homeCardSize: state.homeCardSize,
        previewEnabled: state.previewEnabled,
        interests: state.interests,
        hideWatched: state.hideWatched,
      }),
    }
  )
);
