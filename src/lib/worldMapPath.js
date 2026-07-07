import { feature } from 'topojson-client';
import topology from 'world-atlas/land-110m.json';

// Land silhouette projected to the equirectangular viewBox "0 0 360 180"
// (x = lng + 180, y = 90 - lat) — the SAME projection the demographics bubble
// map uses, so the landmass lines up under the viewer bubbles. Built once at
// module load (topojson decode + projection), then reused as a static string.
function build() {
  try {
    const land = feature(topology, topology.objects.land);
    const geoms = land.type === 'FeatureCollection' ? land.features.map((f) => f.geometry) : [land.geometry];
    let d = '';
    for (const g of geoms) {
      if (!g) continue;
      const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
      for (const poly of polys) {
        for (const ring of poly) {
          // Break the ring wherever it jumps across the antimeridian (Δx > half
          // the map) — otherwise the projected path draws a horizontal streak all
          // the way across (e.g. NE Russia at ~66°N, Antarctica, Fiji).
          let started = false; let prevX = null;
          for (const [lng, lat] of ring) {
            const x = lng + 180; const y = 90 - lat;
            if (!started || Math.abs(x - prevX) > 180) {
              if (started) d += 'Z';
              d += `M${x.toFixed(1)},${y.toFixed(1)}`;
              started = true;
            } else {
              d += `L${x.toFixed(1)},${y.toFixed(1)}`;
            }
            prevX = x;
          }
          if (started) d += 'Z';
        }
      }
    }
    return d;
  } catch {
    return '';
  }
}

export const WORLD_LAND_PATH = build();
