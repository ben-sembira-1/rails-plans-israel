const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** Ground meters per screen pixel of a Web-Mercator map at `zoom` and `latitude`. */
export function metersPerPixel(zoom: number, latitude: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (256 * 2 ** zoom);
}

/**
 * Stroke width (px) that covers `radiusMeters` on each side of a line, at real scale.
 * Never thinner than `minPx`, so zones stay visible when zoomed out.
 */
export function bandWidthPx(radiusMeters: number, zoom: number, latitude: number, minPx: number): number {
  return Math.max(minPx, (2 * radiusMeters) / metersPerPixel(zoom, latitude));
}
