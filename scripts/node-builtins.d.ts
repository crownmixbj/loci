/**
 * Minimal declarations for the node builtins the verification scripts use.
 *
 * `@types/node` is present but not in `compilerOptions.types`, and adding it
 * would pull node's globals into the React Native app's type-check as well —
 * `setTimeout` in particular resolves to `NodeJS.Timeout` there instead of the
 * browser's number, which would ripple through every debounce in the codebase.
 *
 * These scripts run under node, the app does not, so the declarations are
 * scoped to exactly what they call.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function existsSync(path: string): boolean;
  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): { name: string; isDirectory(): boolean }[];
  /** Plain names, which is all the layout sweep needs. */
  export function readdirSync(path: string): string[];
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
}
