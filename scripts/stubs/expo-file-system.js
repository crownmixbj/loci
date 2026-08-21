/**
 * `expo-file-system` for the verification bundles.
 *
 * The real module calls `requireNativeModule('FileSystem')` at import time,
 * which throws under node — so importing anything that reaches `lib/upload.ts`
 * would fail before a single assertion ran.
 *
 * ⚠ `arrayBuffer()` rejects rather than returning bytes, and that is the useful
 *   default.
 *
 *   There is no filesystem behind these tests, so a stub that pretended to read
 *   a file would be asserting against fiction. Rejecting exercises the path
 *   that matters instead: `readFileBytes` is supposed to fall back to XHR when
 *   the file system module refuses, and anything that checks the reader now
 *   checks the fallback works.
 */
class File {
  constructor(uri) {
    this.uri = uri;
  }

  arrayBuffer() {
    return Promise.reject(new Error('No file system in this environment.'));
  }
}

module.exports = { File };
