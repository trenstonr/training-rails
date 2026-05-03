import { resolveSupabaseEnv } from './supabaseClient.js';

function normalizeBase(url) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/\/+$/, '');
}

/**
 * Build a public Storage URL for a defect frame.
 * - Absolute http(s) URLs are returned unchanged.
 * - Relative paths use project URL + `/storage/v1/object/public/{bucket}/{path}`.
 *
 * Bucket: `VITE_SUPABASE_DEFECT_BUCKET` or `PUBLIC_SUPABASE_DEFECT_BUCKET`, default `defect-images`.
 */
export function resolveDefectImageUrl(imagePath) {
  if (imagePath == null) return '';
  const raw = String(imagePath).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const { url: projectUrl } = resolveSupabaseEnv();
  const base = normalizeBase(projectUrl);
  if (!base) return '';

  const bucketRaw =
    import.meta.env.VITE_SUPABASE_DEFECT_BUCKET ||
    import.meta.env.PUBLIC_SUPABASE_DEFECT_BUCKET ||
    'defect-images';
  const bucket = String(bucketRaw).trim() || 'defect-images';

  let pathPart = raw.replace(/^\/+/, '');
  const publicStoragePrefix = 'storage/v1/object/public/';
  const objectStoragePrefix = 'storage/v1/object/';
  if (pathPart.startsWith(publicStoragePrefix)) {
    pathPart = pathPart.slice(publicStoragePrefix.length);
  } else if (pathPart.startsWith(objectStoragePrefix)) {
    pathPart = pathPart.slice(objectStoragePrefix.length);
  }

  const prefix = `${bucket}/`;
  if (pathPart.startsWith(prefix)) pathPart = pathPart.slice(prefix.length);

  const encoded = pathPart
    .split('/')
    .filter((seg) => seg.length > 0)
    .map(encodeURIComponent)
    .join('/');

  if (!encoded) return '';

  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}
