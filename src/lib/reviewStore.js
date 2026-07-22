import { create } from 'zustand';

// Transient (NOT persisted) state for the global "review / feedback" popup.
// openReview({ area, username, permlink }) — area: 'global' | 'stream' | 'upload' | …
// The component is also usable directly with props (embed-studio finish, stream
// end); this store just powers the one global instance mounted in App.
export const useReviewModal = create((set) => ({
  review: null, // { area, username, permlink } while open, else null
  openReview: ({ area = 'global', username = null, permlink = null } = {}) =>
    set({ review: { area, username, permlink } }),
  closeReview: () => set({ review: null }),
}));
