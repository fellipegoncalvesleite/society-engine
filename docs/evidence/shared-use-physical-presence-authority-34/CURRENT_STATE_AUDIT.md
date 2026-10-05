# CORRECTION-34 — CURRENT-STATE AUDIT

Measured on the unmodified CORRECTION-33 tip `5ebb5e98`, before any production change.

## 1. Ghost residence population

`buildCrowdingField` weighted the home scatter by `demography.population` — the **full**
population — from `band.position`. Anyone physically away was projected at home as well.

Natural, 20 years, 4 runs, 2,240 band-seasons: **452 away-worker-seasons still weighted at home.**
Daily, map2:s1 over 6 years: **505 away-worker-days**.

## 2. Missing away presence

Nothing scattered from `expedition.positionTileId`. The same 505 worker-days existed **nowhere**.

**A measurement confound found in this pass's own first probe and corrected:** sampling at season
boundaries measured **0** parties beyond `CROWDING_RADIUS` from their own residence, because at a
season boundary parties are near home. At **daily** resolution, **123 of 202 party-days (60.9%)**
are beyond that radius, p90 distance 13 tiles, max 18. Only the beyond-radius class is decisive —
inside the ball the residence's own scatter covers the tile regardless.

Phase split (daily): outbound 97, returning 89, operating 16, **prepared 0** — `prepared` never
survives to a day boundary. **27 task-camp days**, which the seasonal probe also missed entirely.

## 3. Same-day party invisibility

`crowding.ts` and `sharedCatchment.ts` contain **no reference to `recentIntraSeasonTrips`**. A
same-day party has a real target, route, people count and physical depletion, and is physically
invisible to every shared-range authority. 51,925 distinct trips observed over 20 years.

## 4. Catchment overlap

`getBandForagingDraw` reads `demography.workingAdults`, **not** `getResidentialWorkingAdults`. So
an away worker simultaneously (a) draws the residential foraging catchment, (b) consumes carried
provisions, and (c) harvests at the expedition target. Observed in **226 band-seasons**.

Reported as a measured accounting observation. It is **not** repaired here: §11.7 requires proof
that this is duplication rather than legitimate central-place organisation, and that proof needs a
food-pipeline analysis this checkpoint did not run.

## 5. Social consequences

**Zero.** No encounter, friction or access-memory authority reads expedition party position or trip
records. Parties create no social consequence of any kind, in either arm.
