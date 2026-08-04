# Roadmap Item 4 §3 — how lifecycle phase is encoded in canonical state

`PROVISIONAL_REPRESENTATION_DECISION.md` settled *where* a departed provisional successor lives: a
flagged `Band` inside `world.bands`. It did not settle *how the phase is encoded*. This does.

**Selected: D — two dedicated fields, one per side of the split.** It is B refined by inspection,
which is what "another inspected representation" means here.

---

## 1. What the code already does with `Band.status`

```ts
export type BandStatus =
  | "foraging" | "camped" | "moving" | "settled" | "stressed"   // residential ACTIVITY
  | "splitting"                                                  // a transient fission MARKER
  | "dispersed";                                                 // a terminal LIFECYCLE value
```

Three different kinds of thing already share one field. And `"splitting"` is not what its name
suggests: `demography.ts:1160` writes it to the **parent** as an activity marker *after* a fission
has completed, and it is read by `familiarCountry.ts:316` and `ui/bandSummary.ts:75`. It is not a
phase of anything, and there is no successor-side value at all.

## 2. The options

| | design | verdict |
|---|---|---|
| **A** | extend `Band.status` with lifecycle phases | **Rejected.** The union already conflates activity, a marker and terminality; adding phases makes one field answer a fourth question. CORRECTION-35's finding was precisely that one name quietly answering two questions is a defect — this would be that defect with more values. It would also force a band to choose between being `foraging` and being `travelling`, which are not alternatives: a provisional successor on the move is doing both. |
| **B** | one dedicated `fissionLifecycle` field | Right instinct, wrong shape — see §3. |
| **C** | a broader residential lifecycle field covering provisional / established / returning / terminal | **Rejected as premature.** It would need to absorb `viability.status` and `dispersed`, both of which Item 6 owns. Recorded as the natural successor **when Item 6 opens dissolution and absorption**, which is the change that would justify it. |
| **D** | **two fields: `Band.fissionAttempt` and `Band.provisionalSuccessor`** | **SELECTED.** |

## 3. Why two fields rather than one

The parent's attempt and the successor's provisional period are **different things living on
different bands**:

- `fissionAttempt` sits on the **parent**, is reversible, and **holds no bodies at any phase**;
- `provisionalSuccessor` sits on the **successor**, is physically real, and **owns its own bodies**.

With one field, every reader would have to destructure a role before it could ask its question, and
the question most readers actually ask — *"is this band a provisional successor?"* — would stop being
answerable by the presence of a field. With two, presence **is** the answer:

```
band.fissionAttempt !== undefined        → this band is trying to split
band.provisionalSuccessor !== undefined  → this band IS a provisional successor
```

Both records carry a shared `lineageId`, which is how parent/successor co-residence is recognised
from **direct lifecycle provenance rather than invented kinship** — the §9 requirement.

## 4. The distinctions the predicate set must keep apart

The brief lists six, and each has exactly one predicate in `bandLifecycle.ts`:

| distinction | predicate | note |
|---|---|---|
| living physical group | `isLivingBand` | **unchanged meaning.** A provisional successor **is** living — it eats, crowds, depletes, sickens and dies. Redefining this to mean "established" would hide its bodies and recreate CORRECTION-34's ghosts |
| established residential band | `isEstablishedBand` | living **and not** provisional |
| provisional successor | `isProvisionalSuccessor` | |
| returning successor | `isProvisionalGroupInTransit` | covers `travelling` and `returning` — the two phases where a band has no camp to work from |
| eligible fission parent | `isFissionEligibleParent` | established **and** not already attempting. **A provisional successor may not propose a split of its own** |
| terminal archival band | `isBandTerminal` | unchanged |
| — plus the pair relation | `shareCurrentFissionLineage` | direct provenance, no kinship |

**`isActiveBand` is gone.** It lived privately in `contextCache.ts` as a literal
`return isLivingBand(band)` — a fourth spelling of a question that already had a canonical answer.
Removed, and its two call sites now use the boundary. The change is provably behaviour-identical
because the alias had no body of its own.

## 5. The kernel, and what makes the bounds structural

Phases and transition rules live in the pure kernel `fissionLifecycleKernel.ts`; the `Band` fields
carry only the stored shape. The kernel's contract table gives every phase a body owner, a labour
owner, a location owner, a transition writer, its permitted successors, a bound and a timeout
destination — and `assertSingleOwnership()` fails if a future phase is added without them.

Two properties follow from the table rather than from discipline:

- **No non-terminal phase can persist indefinitely.** Every one has a `maxDays` and an `onTimeout`,
  and K7 drives all seven past their bound.
- **A timeout can never manufacture a success.** `establishing` times out to `failed_early`, not to
  `stabilized` — so **a timer alone cannot stabilize a group**, which is §9's requirement made
  structural rather than remembered. K6 asserts it.

Stabilization additionally requires `livedEvidenceCount >= MIN_LIVED_EVIDENCE_FOR_STABILIZATION`,
refused at the kernel boundary, and departure requires an `endorsedFounderCount` — the count the
parent residual authority endorsed, which is the **revised** one whenever a revision was required.

## 6. Fixtures

`fissionLifecycleKernelAudit.mjs` → `lifecycle-kernel-fixtures.json` — **K1–K14: 14 passing, 0
failing, 0 vacuous**, non-vacuity asserted per fixture.

K9 sweeps **every phase pair** and asserts that exactly the permitted transitions succeed and every
other is refused. K11 asserts no phase lets parent and successor own the same quantity. K14 shows the
kernel cannot read a field it does not declare.

**K2 reported VACUOUS before it passed** — its predicate asserted a path length of 8 where the happy
path has 7 phases. The walk was complete and the fixture was miscounted; recorded rather than quietly
corrected.

## 7. Status, and what this is not

**The kernel is pure and has no callers.** Nothing here connects the lifecycle to the simulation —
that is the world adapter (§6) and it does not exist. `createDaughterBand` is untouched and all six
measured defects are live.

The boundary audit currently **enforces one module and lists eleven as pending**, honestly, rather
than failing the run on work that has not started. An audit that had to be disabled to make progress
would prove nothing. `migrated: true` moves a module into the enforced set as it is done.

**56 hand-inlined terminality sites remain outside the boundary** across the tree. That is a measured
figure, not a defect list: most are in modules the matrix marks *safe unchanged*, and they become
violations only for modules the matrix marks migrated.
