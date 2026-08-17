/**
 * expo-constants, stubbed for the verification bundles.
 *
 * The real module reads native build metadata and touches `__DEV__` at import
 * time, neither of which exists under plain node. `build-info.ts` already
 * treats a missing `expoConfig` as "local build", so returning null here
 * exercises the same fallback path the scripts care about.
 */
module.exports = { default: { expoConfig: null }, expoConfig: null };
