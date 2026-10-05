# Roadmap Item 3 — limitations and carried-forward seams

Classified, not blanket-excused. A limitation that is not written down here is a limitation that a
later checkpoint will rediscover as a defect.

---

## A. THE SIX CARRIED-FORWARD SEAMS — VERBATIM

Copied **verbatim** from the carry-forward block in `docs/HANDOFF.md`, which is the only occurrence
of that block in the repository. Not paraphrased, not reconstructed.

> **If Item 3 is frozen, these seams do NOT close with it** and must be carried forward verbatim:
>
> 1. **the physical shared-use substrate** — `sharedCatchment`'s footprint is residence-anchored, so
>    real trips, expedition routes and investigation walks compete for nothing. Measured and
>    published in `shared-catchment-boundary.json`; **unchanged by CORRECTION-35**.
> 2. **activity-party crowding / expedition overlap / temporary task-party footprints.**
> 3. **no visibility, route or barrier rule** for social perception of any kind.
> 4. **no physical-trace authority** — no tracks, trails, camp remains, trace freshness or cross-band
>    smoke. Belongs to the Persistent Human Landscape pass.
> 5. **`SocialPressureProfile.territorialPressure`** — a second orphan, documented by CORRECTION-35
>    as having **zero readers repository-wide**. Inert, therefore not a blocker; it must not be wired
>    up by a future system without its own lived writer.
> 6. **no UI surfaces the social-evidence lifecycle**, unchanged from Item 3.

### Classification

| # | Seam | Class | Why that class |
|---|---|---|---|
| 1 | residence-anchored shared-use substrate | **current limitation + future dependency** | It is a real gap in physical shared use, not an abstraction chosen for simplicity: two bands whose parties repeatedly cross the same country generate no competition from that crossing. It needs an activity-range footprint authority that does not exist. **This is the largest thing Item 3 does not do.** |
| 2 | activity-party crowding / expedition overlap / task-party footprints | **future dependency** | The presence authority (stage 1 of the chain) already places away bodies correctly, so the substrate exists; what is missing is a rule for what an away party *claims*. Blocked behind seam 1. |
| 3 | no visibility, route or barrier rule | **accepted abstraction** (with a future dependency behind it) | Proximity-as-detection is symmetric and terrain-blind: bands separated by water still meet. Recorded by CORRECTION-29 and -30, and deliberately not invented. Honest as an abstraction *only because it is written down*. |
| 4 | no physical-trace authority | **later-roadmap dependency** | Tracks, trails, camp remains, trace freshness and cross-band smoke belong to the Persistent Human Landscape pass. CORRECTION-30 rejected building it early on inspection, not preference. |
| 5 | `SocialPressureProfile.territorialPressure` | **current limitation** — inert, **not a blocker** | Zero readers repository-wide, so it cannot move behaviour. It is a limitation only in the sense that a dead field with a suggestive name invites a future author to wire it up. Documented in `types.ts` for exactly that reason. |
| 6 | no UI surfaces the social-evidence lifecycle | **current limitation** | The fields are exported and carried into the read model; nothing renders them. A player cannot watch a belief cool and release. Unchanged from the previous audit. |

**None of the six is a blocker.** Seam 5 is explicitly classified as not-a-blocker because it is
inert; the other five are absences rather than contradictions.

**No seam is an Item 4 dependency.** Item 4 (dynamic fission, daughter viability, successor groups)
depends on none of these six; it is unstarted for its own reasons.

---

## B. A THIRD TERRITORIAL NAME — found by this audit

`rules/types.ts:1291` declares a decision-explanation reason type:

```ts
| (BaseReason<"territorial_pressure"> & { readonly pressure: number; })
```

`grep -rn '"territorial_pressure"' src/` returns **only the declaration**. It has **zero producers**,
so no decision can report it and no explanation can name territory.

Classified as an **inert vocabulary entry**, alongside seam 5. It is **not a blocker** and nothing
was changed. It is recorded because the repository now holds three territorial names with no lived
writer between them, and a future territoriality system must claim them deliberately rather than
inherit them by accident.

---

## C. Accepted abstractions

Chosen deliberately, and each defensible only because it is stated.

1. **Aggregate bands, not individuals.** Who *within* a party works — skill, age, injury — needs the
   future individual/household layer. CORRECTION-34D's residence-first allocation is an accounting
   convention, not a claim to locate a person.
2. **Proximity is detection.** See seam 3.
3. **Provisions are a trip-local accounting abstraction.** No residential store is decremented at
   launch; full material conservation is explicitly not claimed for them. The *cargo* chain is what
   conserves (CORRECTION-34B).
4. **Cooling is time-based, not season-aware.** Evidence ages on ticks, not on whether the season
   makes a place relevant.
5. **Reports carry hops and freshness, not a social graph.** Hearsay is discounted structurally
   rather than by who relayed it.
6. **One net demographic rate.** Inherited from persistence-2 and untouched by Item 3.
7. **A party of one is physically permitted by the resolver** and forbidden by policy; none occurs
   naturally (CORRECTION-34F).

---

## D. Current limitations

1. **Crowding never decides an action by itself** in these worlds —
   `crowdingFlippedSelection` reads 0 in both CORRECTION-32 arms. The authority is bounded and
   correct; its *strength* has never been shown to matter to an outcome.
2. **`0.96` is an authority, not a calibrated magnitude.** CORRECTION-32 fixed who charges and
   deliberately did not tune how much.
3. **Part A's corrected interval is rare** — occupied 0 times at the shared-range seed over 200
   years and twice at the incident seed. The repair is contract-driven.
4. **Direct evidence cannot naturally reach that interval at all**; only reported hearsay does.
5. **Seam 6** — nothing surfaces the lifecycle.
6. **Seam 5** — the inert second orphan.
7. **No outcome improvement is claimed anywhere in Item 3.** Not by CORRECTION-28, -29, -30, -31,
   -32, -33, -34 or -35. The item made the world *truthful*, not better.

---

## E. Future dependencies

1. Seam 1 — activity-range shared use.
2. Seam 2 — what an away party claims.
3. Seam 4 — the Persistent Human Landscape.
4. **Same-day party current presence** — formally descoped by CORRECTION-34A because production has
   no within-day consumer. The seam is documented and no dead ledger was built.
5. **The public Day/Season simplification** — deferred and unimplemented. All four internal step
   modes remain batch sizes over one daily kernel.
6. **Cultural or institutional territoriality** — three names wait for it; it must bring a writer.

---

## F. Roadmap Item 4 — absent, and verified absent

Not started. No dynamic fission driven by shared-range pressure, no daughter viability, no
successor-group selection, no prepared-party cancellation to free founders, no founder-policy
change. `createDaughterBand` is untouched by CORRECTION-35, and the production diff from the
previous audit head `742b567` to the candidate freeze head touches exactly six files, none of them
fission.
