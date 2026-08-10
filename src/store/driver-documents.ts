import { supabase } from '@/lib/supabase';

/**
 * Uploads for driver application documents.
 *
 * Files live in a PRIVATE bucket at `<user_id>/<document_key>.<ext>`. That path
 * is not a convention the client is trusted to follow — the storage policies in
 * `05_storage_and_alerts.sql` compare the first segment to `auth.uid()`, so an
 * upload aimed at somebody else's folder is refused by Postgres.
 *
 * Nothing here produces a public URL. Reading is done through short-lived signed
 * URLs, because a public link to a driver's licence would outlive any session
 * that created it.
 */
export const DOCUMENTS_BUCKET = 'driver-documents';

/** Matches the bucket's `file_size_limit`, so the client fails fast. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** The bucket rejects anything else, so it's worth saying so before uploading. */
export const ACCEPTED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

export function mimeFor(fileName: string): string | null {
  return MIME_BY_EXTENSION[extensionOf(fileName)] ?? null;
}

/**
 * The storage path for one document.
 *
 * Keyed on the document slot rather than the original filename, so re-uploading
 * a licence replaces the old one instead of leaving two files where a reviewer
 * has to guess which is current.
 */
export function documentPath(userId: string, key: string, fileName: string): string {
  const extension = extensionOf(fileName) || 'bin';
  return `${userId}/${key}.${extension}`;
}

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Uploads one local file.
 *
 * React Native has no `File`, and `fetch(uri).blob()` is the supported way to
 * read a `file://` or `content://` URI on both platforms. On web the picker
 * already hands back a blob URL, so the same call works there.
 */
export async function uploadDocument(args: {
  userId: string;
  key: string;
  fileName: string;
  uri: string;
}): Promise<UploadResult> {
  const { userId, key, fileName, uri } = args;

  const contentType = mimeFor(fileName);
  if (!contentType) {
    return {
      ok: false,
      error: `${fileName} isn't an accepted format. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`,
    };
  }

  let blob: Blob;
  try {
    const response = await fetch(uri);
    blob = await response.blob();
  } catch {
    return { ok: false, error: `Could not read ${fileName} from this device.` };
  }

  if (blob.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `${fileName} is larger than ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`,
    };
  }

  // An empty blob usually means the URI expired between picking and submitting.
  if (blob.size === 0) {
    return { ok: false, error: `${fileName} came back empty. Attach it again.` };
  }

  const path = documentPath(userId, key, fileName);

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, blob, {
    contentType,
    // Replace rather than fail: a second attempt at the same slot is a
    // correction, not a conflict.
    upsert: true,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

/**
 * A temporary URL a reviewer can open.
 *
 * One hour is long enough to work through a queue and short enough that a URL
 * pasted into a message or left in a browser history stops working. Deliberately
 * not `getPublicUrl`, which would never expire.
 */
export async function signedDocumentUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
