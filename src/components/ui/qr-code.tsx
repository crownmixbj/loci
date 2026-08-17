import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

/**
 * A QR code, drawn as SVG rectangles.
 *
 * `qrcode-generator` produces the module matrix and nothing else — no canvas,
 * no DOM, no image. That matters twice over: it renders identically under
 * react-native-svg on both platforms, and the encoded value never leaves the
 * device. Generating the image through a remote service would have posted a
 * live capture-session id to a third party, which is the one thing the session
 * design treats as a secret.
 *
 * Error correction is 'M' (~15% recoverable). 'L' would give a smaller, denser
 * code, but this is read off a screen by a phone camera at arm's length, often
 * with glare — the redundancy is worth the extra modules.
 */
export function QrCode({
  value,
  size = 200,
  color = '#0F172A',
  background = '#FFFFFF',
}: {
  value: string;
  size?: number;
  color?: string;
  background?: string;
}) {
  const matrix = useMemo(() => {
    // Type number 0 lets the library pick the smallest version that fits.
    const code = qrcode(0, 'M');
    code.addData(value);
    code.make();

    const count = code.getModuleCount();
    const rows: boolean[][] = [];
    for (let row = 0; row < count; row += 1) {
      const cells: boolean[] = [];
      for (let column = 0; column < count; column += 1) {
        cells.push(code.isDark(row, column));
      }
      rows.push(cells);
    }
    return rows;
  }, [value]);

  const count = matrix.length;

  /*
   * The quiet zone is part of the spec, not padding.
   *
   * Four modules of clear space on every side. Scanners use it to find the
   * code's edges; without it, a QR flush against a card border is read slowly
   * or not at all.
   */
  const quiet = 4;
  const total = count + quiet * 2;

  return (
    <View style={{ width: size, height: size, backgroundColor: background }}>
      <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
        <Rect x={0} y={0} width={total} height={total} fill={background} />
        {matrix.map((row, y) =>
          row.map((dark, x) =>
            dark ? (
              <Rect
                key={`${x}-${y}`}
                x={x + quiet}
                y={y + quiet}
                /*
                  A hair over one module. Adjacent rectangles that meet exactly
                  on the boundary leave hairline seams once the SVG is scaled to
                  a non-integer pixel size, and a scanner reads those seams as
                  light modules.
                */
                width={1.02}
                height={1.02}
                fill={color}
              />
            ) : null,
          ),
        )}
      </Svg>
    </View>
  );
}

/** Exported for the verification script: the matrix a value encodes to. */
export function qrModuleCount(value: string): number {
  const code = qrcode(0, 'M');
  code.addData(value);
  code.make();
  return code.getModuleCount();
}
