// Font Awesome icon per audio category/type. Shared by AudioTile (the type
// label under each track) and the audio-type filter chips so the same type
// always shows the same icon. FA is loaded globally (see SECTION_CONFIG icons).
export const AUDIO_CATEGORY_ICONS = {
  song: 'fa-solid fa-music',
  music: 'fa-solid fa-music',
  podcast: 'fa-solid fa-podcast',
  voice_message: 'fa-solid fa-microphone',
  audiobook: 'fa-solid fa-book-open',
  interview: 'fa-solid fa-comments',
};

// Falls back to the voice icon, matching AudioTile's "no category → Voice" label.
export const audioCategoryIcon = (category) =>
  AUDIO_CATEGORY_ICONS[category] || AUDIO_CATEGORY_ICONS.voice_message;
