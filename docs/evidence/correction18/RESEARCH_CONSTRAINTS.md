# CORRECTION-18 — Research and anthropological constraints

This checkpoint changed one production decision structure (destination selection now
filters for viability before ranking) and added typed knowledge provenance. It introduced
**no new demographic, nutritional, yield or fission coefficient**, and moved no threshold.
The constraints below are the ones that bound what was done and what must not be done next.

---

## 1. Whether to divide is a fact about the group, not about the map

The clearest modelling constraint this checkpoint surfaced. In the ethnographic record,
group fissioning is driven by the state of the group and its immediate range: size,
crowding, declining returns, dispute, the labour a subgroup can carry, the season. Whether
a suitable place exists — and how far away it is — determines **where a splinter goes and
whether it survives**, not whether the impulse to divide arises at all.

Production currently subtracts a distance-derived term from split *motivation*
(`travelRiskPenalty` inside `deriveDaughterColonization`), using the same `travelCost` that
already discounts distance in destination *ranking*. The perverse consequence is that a
band which discovers good distant country becomes less willing to divide than one that
knows nothing. That inverts the causal story the simulator is trying to tell, and §9.3
forbids it independently as double-counting.

Constraint for the repair: distance belongs in **feasibility** (can a daughter physically
get there and be supplied) and in **preference** (which of several viable places is
better). It does not belong in motivation.

## 2. A destination must be judged against the daughter, not against the parent's core

Requiring a daughter destination to beat the parent's own occupied range is not supported
by the record. Splinter groups routinely settle land that is poorer than what the parent
holds — that is often the *point*: the parent core is full, contested, or already worked.
The relevant question is whether the projected daughter can live there, not whether the
place is better than the best land the parent already occupies.

This is why §9 splits viability (can the daughter survive here, on band-known evidence)
from motivation (is there reason for a subgroup to leave) from preference (which viable
candidate is best). This checkpoint implemented only the ordering consequence of that split
— viable candidates are no longer masked by higher-scoring non-viable ones — and did **not**
implement the projection model itself.

## 3. Comparing a projection to a realized ledger is a category error

`expectedPerCapita` is a normalized per-tile ecological yield fraction; `currentPerCapita`
is the parent's whole-catchment physical support divided by its whole-band demand. They are
not the same quantity, and their difference is not "habitat advantage". Any future
comparison must be projected-vs-projected or realized-vs-realized (§10).

Measured here: the error understates the candidate side by roughly 5–6×. Its practical
effect on the default maps is to make the gate **too permissive** rather than impassable —
the opposite of the predicted direction. That surprise is itself the constraint: a
dimensional defect does not have a predictable behavioural sign, so it must be repaired on
correctness grounds and its behavioural consequence must be measured afterwards, never
assumed.

## 4. Exploration must keep costing something real

The measured regression is attributable to expedition labour. It would be trivial to make
it disappear by shortening journeys, shrinking parties, exploring less often, or crediting
the expedition with food — and every one of those is forbidden (§13). Two people away from
camp for ten to twenty days is a real subsistence cost, and a model in which reconnaissance
is nearly free would be a worse model, not a better one.

The legitimate questions are (a) whether the trigger fires too readily, and (b) whether the
benefit side is broken — which it demonstrably was, since destination selection discarded
6,413 viable candidates. Fixing the benefit is the correct response to a cost that does not
currently pay for itself; suppressing the cost is not.

**Open question, unchanged from CORRECTION-17 and now more pressing.** The current model
makes hunger *increase* willingness to explore. A labour-budget argument predicts the
opposite: a band under acute subsistence stress cannot spare two adults for a speculative
journey, and exploration should be a behaviour of groups with a modest surplus and a
structural reason to move. This must be settled with evidence before the trigger is tuned
in either direction.

## 5. Traversal is not residence

A tile walked once by two people crossing it is not epistemically equivalent to country a
band has worked for seasons, even though both are "personally observed". The new
`KnowledgeAcquisitionKind` field exists to keep that distinction available to confidence,
retention and compression — and to make it auditable which consumers read shallow
knowledge as though it were lived.

The provenance rule implemented here follows from the same principle: acquisition
**upgrades but never downgrades**. A party passing through country the band already lives
in cannot relabel it as shallow.

## 6. Bounded memory is a claim that must be proved, not asserted

§14's requirement stands and was **not discharged**. The retained-knowledge structure is
still not provably bounded: `memoryCompression` exempts every visited high-value water tile
from `MAX_EXACT_KNOWN_TILES` via a mandatory set with no cap of its own, and exploration
walks more river country than residence alone. Until the maximum possible retained
structure is explicit and 500- and 1,000-year runs confirm it, the system must not be
described as bounded.

## 7. Explicitly NOT calibrated here

No empirical claim is made about exploration frequency, party size, journey length, or the
rate at which distant country becomes usable habitat in any real forager population. The
bounds in use remain engineering bounds inherited from CORRECTION-17, not ethnographic
quantities, and must not be cited as such.
