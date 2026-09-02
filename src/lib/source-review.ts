/**
 * Compare timestamps as instants rather than as serialized strings.
 *
 * Supabase/PostgREST may return the same timestamptz as either a trailing
 * `Z` or an explicit `+00:00` offset. String equality would incorrectly mark
 * a source review as stale in that case.
 */
export function sameInstant(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  const leftMilliseconds = Date.parse(left);
  const rightMilliseconds = Date.parse(right);
  return Number.isFinite(leftMilliseconds)
    && Number.isFinite(rightMilliseconds)
    && leftMilliseconds === rightMilliseconds;
}
