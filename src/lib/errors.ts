/**
 * Getting the server's sentence out of whatever was thrown.
 *
 * ⚠ `thrown instanceof Error` is false for every Supabase failure, and that one
 *   line has been hiding every database refusal in the admin area.
 *
 *   `PostgrestError` is a plain object — `{ message, details, hint, code }` —
 *   built from a JSON response. It has never been an `Error` subclass. So every
 *   `catch (thrown) { thrown instanceof Error ? thrown.message : 'The database
 *   refused the change.' }` in this project took the *second* branch, always,
 *   and printed the same eleven words no matter what Postgres actually said.
 *
 *   The damage is not cosmetic. "Use the phone number you signed up with" and
 *   "Remove this person's admin role first" both name the next step; "The
 *   database refused the change" names nothing. An operator hitting the first
 *   one had no way to tell it from the second, and no way to tell either from a
 *   network failure — which is exactly the position the erase button left
 *   somebody in.
 *
 * Everything here is defensive on purpose: this runs in a `catch`, and a
 * function that throws while explaining a throw is worse than useless.
 */

/** The shape Supabase returns. Not an Error, despite reading like one. */
type PostgrestLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

/**
 * The most useful sentence available, or the fallback.
 *
 * ⚠ `details` and `hint` are appended when they add something.
 *
 *   Postgres puts the interesting part in different places depending on how it
 *   failed. A CHECK violation says "new row for relation "x" violates check
 *   constraint "y"" in `message` and nothing in `details`; a raised exception
 *   from plpgsql puts the whole sentence in `message`; a foreign key failure
 *   puts the useful half in `details`. Taking only `message` loses the third
 *   case, and the third case is the one nobody guesses.
 */
export function errorMessage(thrown: unknown, fallback = 'Something went wrong.'): string {
  if (typeof thrown === 'string' && thrown.trim()) return thrown.trim();

  if (thrown instanceof Error && thrown.message) return thrown.message;

  if (thrown && typeof thrown === 'object') {
    const error = thrown as PostgrestLike;

    const parts = [error.message, error.details, error.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim());

    /*
     * De-duplicated, because Postgres often repeats itself: a raised exception
     * frequently arrives with `details` echoing `message`, and showing the same
     * sentence twice reads as a rendering bug.
     */
    const unique = [...new Set(parts)];

    if (unique.length > 0) {
      const code = typeof error.code === 'string' && error.code ? ` (${error.code})` : '';
      return `${unique.join(' — ')}${code}`;
    }
  }

  return fallback;
}
