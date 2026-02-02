import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAuthUserSlice } from './slices/createAuthStore';
import { createStudioSlice } from './slices/createStudioSlice';
import { createUserDetailsSlice } from './slices/createUserStore';
import { createVideoSlice } from './slices/createVideoSlice';
import {createPostProcessingSlice} from "./slices/createPostProcessingSlice"
import { createThemeSlice } from './slices/createThemeSlice';

export const useAppStore = create(
  persist(
    (...a) => ({
      ...createAuthUserSlice(...a),
      ...createStudioSlice(...a),
      ...createUserDetailsSlice(...a),
      ...createVideoSlice(...a),
      ...createPostProcessingSlice(...a),
      ...createThemeSlice(...a)
    }),
    {
      name: 'user-store', // The storage key for persisting user data
      partialize: (state) => ({
        user: state.user, // Persist only the `user` slice
        isProcessing: state.isProcessing,
        theme: state.theme, // Persist theme preference
      }),
      onRehydrateStorage: () => (state) => {
        // Apply the theme to DOM after store is rehydrated from localStorage
        if (state?.theme) {
          const effectiveTheme = state.theme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : state.theme;
          document.documentElement.setAttribute('data-theme', effectiveTheme);
          if (effectiveTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },
    }
  )
);
