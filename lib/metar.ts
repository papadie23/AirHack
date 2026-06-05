// Pure formatting utilities for METAR display. No imports, no React.

export function flightCategoryColor(
  cat: "VFR" | "MVFR" | "IFR" | "LIFR"
): { bg: string; text: string; border: string } {
  switch (cat) {
    case "VFR":
      return { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50" };
    case "MVFR":
      return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50" };
    case "IFR":
      return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" };
    case "LIFR":
      return { bg: "bg-fuchsia-500/20", text: "text-fuchsia-400", border: "border-fuchsia-500/50" };
  }
}

const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE",
  "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW",
  "W", "WNW", "NW", "NNW",
];

export function windDirectionLabel(deg: number): string {
  const index = Math.round(((deg % 360) + 360) / 22.5) % 16;
  return COMPASS_POINTS[index];
}

const COVER_LABELS: Record<string, string> = {
  SKC: "Sky Clear",
  CLR: "Clear",
  FEW: "Few",
  SCT: "Scattered",
  BKN: "Broken",
  OVC: "Overcast",
  VV: "Vertical Vis.",
};

export function cloudCoverLabel(cover: string): string {
  return COVER_LABELS[cover] ?? cover;
}

export function cloudCoverPercent(cover: string): number {
  switch (cover) {
    case "SKC":
    case "CLR":
      return 0;
    case "FEW":
      return 25;
    case "SCT":
      return 50;
    case "BKN":
      return 75;
    case "OVC":
    case "VV":
      return 100;
    default:
      return 0;
  }
}

export function formatQnh(hpa: number): string {
  const inHg = (hpa * 0.02953).toFixed(2);
  return `${hpa} hPa / ${inHg} inHg`;
}

export function formatVisibility(meters: number, unlimited: boolean): string {
  if (unlimited || meters >= 9999) return "> 10 km";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

export function formatTemp(c: number): string {
  return `${c >= 0 ? "+" : ""}${c}°C`;
}
