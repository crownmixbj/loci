import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type RiderIllustrationProps = {
  width?: number;
  height?: number;
};

/**
 * Stylized delivery rider for the hero card. Drawn in code rather than shipped
 * as an asset so it scales cleanly and picks up theme colours.
 */
export function RiderIllustration({ width = 132, height = 118 }: RiderIllustrationProps) {
  const theme = useTheme();

  const accent = theme.primary;
  const accentSoft = theme.primaryOnSoft;
  const dark = theme.background;

  return (
    <Svg width={width} height={height} viewBox="0 0 132 118" fill="none">
      {/* Glow behind the subject */}
      <Circle cx="76" cy="56" r="48" fill={accent} opacity={0.16} />
      <Circle cx="76" cy="56" r="32" fill={accent} opacity={0.12} />

      {/* Road */}
      <Rect x="8" y="98" width="116" height="3" rx="1.5" fill={accentSoft} opacity={0.35} />
      <Rect x="20" y="105" width="26" height="3" rx="1.5" fill={accentSoft} opacity={0.18} />
      <Rect x="56" y="105" width="16" height="3" rx="1.5" fill={accentSoft} opacity={0.18} />

      {/* Wheels */}
      <Circle cx="36" cy="86" r="13" stroke={accentSoft} strokeWidth="3.5" />
      <Circle cx="36" cy="86" r="3" fill={accentSoft} />
      <Circle cx="98" cy="86" r="13" stroke={accentSoft} strokeWidth="3.5" />
      <Circle cx="98" cy="86" r="3" fill={accentSoft} />

      {/* Frame and handlebars */}
      <Path
        d="M36 86 L57 62 L82 62 L98 86"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M82 62 L92 50" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      <Path d="M86 47 L99 47" stroke={accent} strokeWidth="4" strokeLinecap="round" />

      {/* Cargo box */}
      <G>
        <Rect x="26" y="52" width="30" height="26" rx="5" fill={accent} />
        <Path d="M41 52 v26" stroke={dark} strokeWidth="2.5" opacity={0.45} />
        <Path d="M26 63 h30" stroke={dark} strokeWidth="2.5" opacity={0.45} />
      </G>

      {/* Rider */}
      <Ellipse cx="66" cy="52" rx="10" ry="13" fill={accentSoft} />
      <Circle cx="72" cy="30" r="10" fill={accentSoft} />
      {/* Helmet visor */}
      <Path d="M63 28 a10 10 0 0 1 18 -3 l-17 6 Z" fill={dark} opacity={0.55} />
      {/* Arm reaching for the bars */}
      <Path d="M74 46 L90 44" stroke={accentSoft} strokeWidth="5" strokeLinecap="round" />
      {/* Leg */}
      <Path d="M64 64 L70 78" stroke={accentSoft} strokeWidth="5" strokeLinecap="round" />

      {/* Motion lines */}
      <Path d="M6 44 h16" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity={0.55} />
      <Path d="M2 56 h11" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity={0.35} />
      <Path d="M8 68 h14" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity={0.25} />
    </Svg>
  );
}
