/**
 * A stub for `react-native` under node.
 *
 * The verification scripts import store modules for their pure logic, but those
 * modules reach `@/lib/supabase`, which imports react-native — whose entry point
 * is Flow, not TypeScript, and cannot be bundled by esbuild. Nothing under test
 * calls any of this; it exists so the import graph resolves.
 */
module.exports = {
  Platform: { OS: 'web', select: (spec) => spec.web ?? spec.default },
  AppState: { addEventListener: () => ({ remove() {} }) },
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
};
