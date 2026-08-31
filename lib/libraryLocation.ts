/**
 * Set these to your actual library building's coordinates. Get them by
 * opening Google Maps, right-clicking the library entrance, and copying
 * the lat/lng shown at the top of the context menu.
 *
 * radiusMeters is deliberately generous (GPS drifts indoors/near tall
 * buildings) — this is a "roughly at the library" check, paired with the
 * fact that the gate URL is only reachable by scanning a sticker
 * physically posted at the entrance. Neither signal alone is proof;
 * together they're a reasonable bar for a hackathon/college deployment.
 */
export const LIBRARY_LOCATION = {
  name: "Thapar Institute Library",
  latitude: 30.3543790,
  longitude: 76.3698493,
  radiusMeters: 200,
};

/** Haversine distance between two lat/lng points, in meters. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}