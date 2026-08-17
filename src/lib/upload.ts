/**
 * Reading a local file so Supabase Storage will accept it.
 *
 * ⚠ THIS EXISTS BECAUSE THE SAME BUG WAS WRITTEN THREE TIMES.
 *
 *   Every upload in this app started as `fetch(uri).blob()`, and that one line
 *   fails in two different ways on a real Android phone:
 *
 *     1. `Response.prototype.blob` is sometimes undefined. React Native's fetch
 *        is `whatwg-fetch`, which only defines `blob()` if `Blob` and
 *        `FileReader` are globals when the polyfill loads — they are installed
 *        lazily by `setUpXHR`, so it depends on module evaluation order.
 *        Hermes reports the result as "undefined is not a function", which is
 *        what the delivery proof upload showed.
 *
 *     2. When it *does* work, `blob.type` is whatever RN's file handler put in
 *        the response header, and for a `file://` read that is regularly
 *        `text/plain`. Passing it through as the content type gets the object
 *        rejected by a bucket that allows images:
 *
 *            mime type text/plain is not supported
 *
 *        which is what the sender's verification photo showed. The photo was
 *        fine; the label on it was not.
 *
 *   `XMLHttpRequest` with `responseType = 'arraybuffer'` is React Native core.
 *   It decodes natively and touches neither Blob nor FileReader, and the
 *   content type comes from the file *name*, which is the thing that actually
 *   knows what the file is.
 *
 * Fixing one caller and not the others is how this got written three times, so
 * every upload in the app now goes through here.
 */

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/**
 * The file extension on a URI or file name, lowercased, defaulting to jpg.
 *
 * Query strings and fragments are stripped first: a `blob:` or `content://`
 * URI can carry one, and `photo.jpg?w=100` would otherwise yield an extension
 * of `jpg?w=100` and a file stored under that name.
 */
export function extensionOf(nameOrUri: string): string {
  const clean = nameOrUri.trim().split(/[?#]/)[0];
  return (/\.([A-Za-z0-9]+)$/.exec(clean)?.[1] ?? 'jpg').toLowerCase();
}

/** The content type to store an object under, taken from its name. */
export function contentTypeFor(nameOrUri: string): string {
  return MIME[extensionOf(nameOrUri)] ?? 'image/jpeg';
}

export type FileBytes = { bytes: ArrayBuffer; contentType: string };

/**
 * Refuses anything that is not an image, before Storage has to.
 *
 * ⚠ This exists because "mime type text/plain is not supported" reached a real
 *   sender twice.
 *
 *   That message comes from Supabase Storage rejecting the bucket's allowed
 *   types — which means the app had already built a request, sent a photo, and
 *   learned what was wrong from a server that knows nothing about cameras. The
 *   sender was told their photo failed; the photo was fine.
 *
 *   Checking here turns a remote rejection into a local one that can name the
 *   type it was about to send, so the next occurrence is diagnosable from the
 *   screenshot alone rather than from another round trip.
 *
 * Not applied inside `readFileBytes` itself: driver documents are legitimately
 * PDFs. Only the photo callers use this.
 */
export function assertImageBytes(file: FileBytes, what = 'photo'): FileBytes {
  if (!file.contentType.startsWith('image/')) {
    throw new Error(
      `That ${what} came back as ${file.contentType}, which is not an image. ` +
        'Take it again, or pick it from your gallery.',
    );
  }
  return file;
}

/**
 * Reads a local file as bytes.
 *
 * `contentTypeHint` wins when the caller genuinely knows better — a document
 * picker reports the type the OS assigned, which beats guessing from an
 * extension the user may have typed.
 */
export function readFileBytes(uri: string, contentTypeHint?: string): Promise<FileBytes> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.onload = () => {
      const bytes = request.response as ArrayBuffer | null;

      if (!bytes || bytes.byteLength === 0) {
        reject(new Error('That file came back empty — try again.'));
        return;
      }

      resolve({
        bytes,
        /*
         * The name first, the response header last.
         *
         * A `file://` read has no useful header, and the one RN invents is what
         * got a perfectly good JPEG rejected as text/plain.
         */
        contentType:
          contentTypeHint ||
          contentTypeFor(uri) ||
          request.getResponseHeader('content-type') ||
          'application/octet-stream',
      });
    };

    request.onerror = () => reject(new Error('Could not read that file off this device.'));
    request.onabort = () => reject(new Error('Reading the file was interrupted.'));
    request.ontimeout = () => reject(new Error('Reading the file timed out.'));

    try {
      request.open('GET', uri, true);
      request.responseType = 'arraybuffer';
      request.send();
    } catch (thrown) {
      reject(thrown instanceof Error ? thrown : new Error('Could not open that file.'));
    }
  });
}
