import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Radius } from '@/constants/theme';

/**
 * A Leaflet map, on web and native, from one source of truth.
 *
 * The same HTML document is used on both platforms: rendered into an `<iframe>`
 * on web and a `WebView` on native. That is deliberate — maintaining a
 * react-leaflet tree for web and a react-native-maps tree for native means two
 * implementations that drift, and react-native-maps has no web support at all.
 *
 * Tiles come from OpenStreetMap, which needs no API key and no billing account.
 * Their tile usage policy asks for attribution and reasonable volumes; the
 * attribution control below is required, not decorative.
 */
export type MapMarker = {
  lat: number;
  lng: number;
  /** Shown in the popup. */
  label: string;
  /** Pickup green, dropoff blue, neutral grey. */
  tone?: 'pickup' | 'dropoff' | 'neutral';
};

export type MapViewProps = {
  markers: MapMarker[];
  /** Draws a straight line between the first two markers. */
  showRoute?: boolean;
  height?: number;
  /**
   * Turns the map into a picker: tapping sets a pin and reports the position.
   * Undefined leaves the map read-only.
   */
  onPick?: (position: { lat: number; lng: number }) => void;
  /** Centre when there are no markers. Defaults to roughly the middle of Nigeria. */
  center?: { lat: number; lng: number };
};

const NIGERIA_CENTER = { lat: 9.08, lng: 8.68 };

const TONE_COLORS: Record<NonNullable<MapMarker['tone']>, string> = {
  pickup: '#16A34A',
  dropoff: '#0077B6',
  neutral: '#64748B',
};

/**
 * Escapes text going into the generated HTML.
 *
 * Labels are user-entered — an item description or an address — so they reach
 * this as untrusted input. Interpolating them raw would put an injection hole
 * inside the WebView.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(props: MapViewProps): string {
  const { markers, showRoute, onPick, center } = props;

  const fallback = center ?? NIGERIA_CENTER;
  const points = markers.map((m) => ({
    lat: m.lat,
    lng: m.lng,
    label: escapeHtml(m.label),
    color: TONE_COLORS[m.tone ?? 'neutral'],
  }));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #E0F2FE; }
  .leaflet-container { font-family: -apple-system, system-ui, sans-serif; }
  .pin {
    width: 18px; height: 18px; border-radius: 50%;
    border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4);
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var points = ${JSON.stringify(points)};
  var pickable = ${onPick ? 'true' : 'false'};

  var map = L.map('map', { zoomControl: true, attributionControl: true })
    .setView([${fallback.lat}, ${fallback.lng}], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  function pinIcon(color) {
    return L.divIcon({
      className: '',
      html: '<div class="pin" style="background:' + color + '"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  var drawn = [];
  points.forEach(function (p) {
    var marker = L.marker([p.lat, p.lng], { icon: pinIcon(p.color) }).addTo(map);
    if (p.label) marker.bindPopup(p.label);
    drawn.push([p.lat, p.lng]);
  });

  ${
    showRoute
      ? `
  if (drawn.length >= 2) {
    // A straight line, not a driving route. Drawing a road route would need a
    // routing service; pretending a straight line is one would misstate distance.
    L.polyline(drawn.slice(0, 2), { color: '#0077B6', weight: 3, dashArray: '6 6' }).addTo(map);
  }`
      : ''
  }

  if (drawn.length === 1) {
    map.setView(drawn[0], 14);
  } else if (drawn.length > 1) {
    map.fitBounds(L.latLngBounds(drawn), { padding: [40, 40] });
  }

  if (pickable) {
    var picked = null;
    map.on('click', function (e) {
      if (picked) map.removeLayer(picked);
      picked = L.marker(e.latlng, { icon: pinIcon('#16A34A') }).addTo(map);
      var message = JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng });
      // Native reads this bridge; web listens for the postMessage below.
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
      else window.parent.postMessage(message, '*');
    });
  }
</script>
</body>
</html>`;
}

export function MapView(props: MapViewProps) {
  const { height = 240, onPick } = props;
  const html = useMemo(() => buildHtml(props), [props]);

  /*
   * The iframe reports picks with `postMessage`, so the listener belongs on
   * `window` — and must be removed again. Attaching it from the `ref` callback
   * added a fresh listener on every render and never cleaned any of them up,
   * so a sender who moved the pin ten times had ten handlers firing.
   */
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const listener = (event: MessageEvent) => {
      const handler = pickRef.current;
      if (!handler) return;

      try {
        const data = JSON.parse(String(event.data));
        if (typeof data?.lat === 'number' && typeof data?.lng === 'number') {
          handler({ lat: data.lat, lng: data.lng });
        }
      } catch {
        // The page receives plenty of messages that aren't ours.
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  if (Platform.OS === 'web') {
    /*
     * An iframe with `srcDoc` rather than injecting Leaflet into the host page:
     * it keeps the map's CSS and global `L` out of the app's document, and it
     * means the exact same HTML runs on both platforms.
     */
    return (
      <View style={[styles.frame, { height }]}>
        {/* eslint-disable-next-line react/no-danger */}
        <iframe
          srcDoc={html}
          style={{ border: 'none', width: '100%', height: '100%' }}
          title="Map"
          /*
            Scripts must run; everything else stays off. Without
            `allow-same-origin` the frame is treated as a unique origin, so its
            script cannot reach into the app's document — it can only post
            messages out, which is exactly the channel we want.
          */
          sandbox="allow-scripts"
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        onMessage={(event) => {
          if (!onPick) return;
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (typeof data?.lat === 'number' && typeof data?.lng === 'number') {
              onPick({ lat: data.lat, lng: data.lng });
            }
          } catch {
            // Ignore anything that isn't a coordinate.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#E0F2FE',
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
