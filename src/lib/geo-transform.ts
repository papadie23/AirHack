/**
 * Affine pixel↔GPS transform for LRIA T4 floor plan images.
 * Calibrated from 6 ground-truth points measured on-site.
 *
 * Image: "Plan parter fluxuri ON.jpg"
 * Rotation vs North: ~65°  |  Scale: ~1.54 cm/px
 */

export interface PixelPoint { x: number; y: number }
export interface GpsPoint   { lat: number; lng: number }

// Control points (pixel → GPS)
const CTRL: Array<PixelPoint & GpsPoint> = [
  { x: 8173,  y: 3867, lat: 47.174432, lng: 27.619330 }, // Intrare T4
  { x: 8133,  y: 2927, lat: 47.174512, lng: 27.619394 }, // Check-in 1
  { x: 8858,  y: 2927, lat: 47.174452, lng: 27.619414 }, // Check-in 5
  { x: 9502,  y: 2900, lat: 47.174341, lng: 27.619515 }, // Check-in 10
  { x: 8911,  y: 3947, lat: 47.174513, lng: 27.619255 }, // Baza Scări
];

// Least-squares affine solution (precomputed, skip check-in 15 outlier)
// lat = A*x + B*y + C
// lng = D*x + E*y + F
function solve3(pts: typeof CTRL, getZ: (p: typeof CTRL[0]) => number): [number,number,number] {
  let AtA = [[0,0,0],[0,0,0],[0,0,0]];
  let Atb = [0,0,0];
  for (const p of pts) {
    const row = [p.x, p.y, 1];
    const z = getZ(p);
    for (let i=0;i<3;i++) {
      Atb[i] += row[i]*z;
      for (let j=0;j<3;j++) AtA[i][j] += row[i]*row[j];
    }
  }
  function det(m: number[][]): number {
    return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
          -m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
          +m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  }
  const D = det(AtA);
  return [0,1,2].map(i => {
    const M = AtA.map(r=>[...r]);
    for (let r=0;r<3;r++) M[r][i] = Atb[r];
    return det(M)/D;
  }) as [number,number,number];
}

const [A,B,C] = solve3(CTRL, p => p.lat);
const [D,E,F] = solve3(CTRL, p => p.lng);

// Inverse: px = a*lat + b*lng + c
const [a,b,c] = solve3(
  CTRL.map(p => ({ x: p.lat, y: p.lng, lat: p.x, lng: p.y } as typeof CTRL[0])),
  p => p.lat
);
const [d,e,f] = solve3(
  CTRL.map(p => ({ x: p.lat, y: p.lng, lat: p.x, lng: p.y } as typeof CTRL[0])),
  p => p.lng
);

/** Convert image pixel → GPS */
export function pixelToGps(px: PixelPoint): GpsPoint {
  return {
    lat: A * px.x + B * px.y + C,
    lng: D * px.x + E * px.y + F,
  };
}

/** Convert GPS → image pixel */
export function gpsToPixel(gps: GpsPoint): PixelPoint {
  return {
    x: a * gps.lat + b * gps.lng + c,
    y: d * gps.lat + e * gps.lng + f,
  };
}

// ── Key locations in pixel space (from floor plan) ────────────────────────────
export const LOCATIONS = {
  intrare:     { x: 8173,  y: 3867 },
  checkin1:    { x: 8133,  y: 2927 },
  checkin5:    { x: 8858,  y: 2927 },
  checkin10:   { x: 9502,  y: 2900 },
  bazaScari:   { x: 8911,  y: 3947 },
  // Securitate (estimat pe baza planului)
  securitate:  { x: 9800,  y: 3200 },
} as const;

// Image natural dimensions (approximate from file)
export const IMG_W = 13500;
export const IMG_H = 5000;
