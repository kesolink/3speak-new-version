import { uploadThumbnail } from '../../utils/uploadThumbnail';

// Inline editor/body image upload. Routes through the shared image pipeline: the
// @threespeak backend signs the hive.blog challenge and uploads on our behalf
// (works for every login, incl. HiveSigner), falling back to user-signed
// hive.blog / the 3Speak image server. Replaces the old path that signed with a
// hardcoded VITE_HIVE_POSTING_KEY baked into the bundle.
export async function uploadImageToHive(file) {
  return uploadThumbnail(file);
}
