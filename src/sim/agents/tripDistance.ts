// SCALE-1 Task 7 — canonical physical round-trip derivation for residence-returning
// intra-season activity trips. `distanceKm` is the stored OUTBOUND physical route length;
// raw tile counts remain topology/debug telemetry and are never reconstructed into km here.
export function deriveRoundTripDistanceKm(outboundDistanceKm: number): number {
  return Math.max(0, outboundDistanceKm) * 2;
}

export function getTripRoundTripDistanceKm(record: { readonly distanceKm: number }): number {
  return deriveRoundTripDistanceKm(record.distanceKm);
}
