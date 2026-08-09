import type { ImageSourcePropType } from 'react-native';

/**
 * Hero photograph behind the headline and search cards.
 *
 * There's no `public/` folder in an Expo app — bundled assets live under
 * `assets/` and are resolved by Metro at build time, so the path has to be a
 * static `require`, not a runtime string.
 *
 * To switch the photo on:
 *   1. save the image to `assets/images/hero-bg.jpg`
 *   2. replace the `null` below with
 *      `require('@/../assets/images/hero-bg.jpg')`
 *
 * While this is null the hero falls back to the vector rider illustration, so
 * the layout and the glass cards behave the same either way.
 */
export const HERO_BACKGROUND: ImageSourcePropType | null = require('@/../assets/images/hero-bg.jpg');
