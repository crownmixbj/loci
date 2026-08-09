import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

/**
 * Decorative background patterns for the service cards. Each draws on a
 * 120x120 grid and is tiled by scaling the viewBox, so they stay crisp at any
 * card size — no raster assets, no network fetch.
 *
 * They sit above the card's fill and below its text, at low opacity: the copy
 * has to stay the thing you read.
 */
export type PatternProps = {
  color: string;
  width: number;
  height: number;
  opacity?: number;
};

/** Card 1 — connected route network: nodes joined by delivery legs. */
export function RouteNetworkPattern({ color, width, height, opacity = 0.14 }: PatternProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" opacity={opacity}>
      <G stroke={color} strokeWidth={1.5} fill="none">
        <Line x1={12} y1={96} x2={40} y2={54} />
        <Line x1={40} y1={54} x2={74} y2={72} />
        <Line x1={74} y1={72} x2={104} y2={26} />
        <Line x1={40} y1={54} x2={30} y2={16} />
        <Line x1={74} y1={72} x2={96} y2={104} />
        <Line x1={12} y1={96} x2={54} y2={110} />
      </G>
      <G fill={color}>
        <Circle cx={12} cy={96} r={4} />
        <Circle cx={40} cy={54} r={5} />
        <Circle cx={74} cy={72} r={5} />
        <Circle cx={104} cy={26} r={4} />
        <Circle cx={30} cy={16} r={3} />
        <Circle cx={96} cy={104} r={3} />
        <Circle cx={54} cy={110} r={3} />
      </G>
      {/* Squared-off legs echo a routing diagram rather than a straight line. */}
      <Path
        d="M8 30 H26 V44 H48"
        stroke={color}
        strokeWidth={1.2}
        fill="none"
        strokeDasharray="4 4"
      />
      <Path d="M62 12 H88 V38" stroke={color} strokeWidth={1.2} fill="none" strokeDasharray="4 4" />
    </Svg>
  );
}

/** Card 2 — city street grid, with blocks and a couple of arterial roads. */
export function CityMapPattern({ color, width, height, opacity = 0.14 }: PatternProps) {
  const streets = [18, 42, 66, 90, 114];

  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" opacity={opacity}>
      <G stroke={color} strokeWidth={1} fill="none">
        {streets.map((v) => (
          <Line key={`h${v}`} x1={0} y1={v} x2={120} y2={v} />
        ))}
        {streets.map((v) => (
          <Line key={`v${v}`} x1={v} y1={0} x2={v} y2={120} />
        ))}
      </G>
      {/* Two wider arterials cutting across the grid. */}
      <G stroke={color} strokeWidth={3} fill="none" opacity={0.8}>
        <Line x1={0} y1={78} x2={120} y2={78} />
        <Line x1={30} y1={0} x2={30} y2={120} />
      </G>
      {/* City blocks. */}
      <G fill={color} opacity={0.5}>
        <Rect x={46} y={22} width={16} height={16} rx={2} />
        <Rect x={70} y={46} width={16} height={16} rx={2} />
        <Rect x={94} y={94} width={16} height={16} rx={2} />
        <Rect x={4} y={46} width={12} height={16} rx={2} />
      </G>
    </Svg>
  );
}

/** Card 3 — tiled documents, each with rule lines and a wax seal. */
export function DocumentPattern({ color, width, height, opacity = 0.14 }: PatternProps) {
  const sheet = (x: number, y: number, key: string) => (
    <G key={key}>
      <Rect
        x={x}
        y={y}
        width={30}
        height={38}
        rx={3}
        stroke={color}
        strokeWidth={1.4}
        fill="none"
      />
      <G stroke={color} strokeWidth={1.2}>
        <Line x1={x + 6} y1={y + 9} x2={x + 24} y2={y + 9} />
        <Line x1={x + 6} y1={y + 15} x2={x + 24} y2={y + 15} />
        <Line x1={x + 6} y1={y + 21} x2={x + 18} y2={y + 21} />
      </G>
      {/* Seal, bottom-right of each sheet. */}
      <Circle cx={x + 22} cy={y + 30} r={5} fill={color} opacity={0.75} />
      <Circle cx={x + 22} cy={y + 30} r={2} fill="none" stroke={color} strokeWidth={0.8} />
    </G>
  );

  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" opacity={opacity}>
      {sheet(6, 6, 'a')}
      {sheet(48, 6, 'b')}
      {sheet(90, 6, 'c')}
      {sheet(6, 54, 'd')}
      {sheet(48, 54, 'e')}
      {sheet(90, 54, 'f')}
    </Svg>
  );
}

/** Card 4 — stacked industrial crates, drawn as outlines with cross-bracing. */
export function CratePattern({ color, width, height, opacity = 0.14 }: PatternProps) {
  const crate = (x: number, y: number, size: number, key: string) => (
    <G key={key} stroke={color} strokeWidth={1.4} fill="none">
      <Rect x={x} y={y} width={size} height={size * 0.78} rx={2} />
      {/* Diagonal bracing plus a centre band — reads as a shipping crate. */}
      <Line x1={x} y1={y} x2={x + size} y2={y + size * 0.78} strokeWidth={0.9} />
      <Line x1={x + size} y1={y} x2={x} y2={y + size * 0.78} strokeWidth={0.9} />
      <Line x1={x} y1={y + size * 0.26} x2={x + size} y2={y + size * 0.26} strokeWidth={0.9} />
    </G>
  );

  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" opacity={opacity}>
      {crate(8, 8, 32, 'a')}
      {crate(48, 8, 32, 'b')}
      {crate(88, 8, 26, 'c')}
      {crate(8, 52, 32, 'd')}
      {crate(48, 52, 32, 'e')}
      {crate(88, 52, 26, 'f')}
      {crate(28, 92, 32, 'g')}
      {crate(70, 92, 32, 'h')}
    </Svg>
  );
}
