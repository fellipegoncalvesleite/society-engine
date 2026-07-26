# CORRECTION-19 — Research and anthropological constraints

This checkpoint is an accounting audit. Its question is not "should exploration cost
something" — it obviously should — but "is the cost the simulator charges the same cost
twice, or charged to the wrong people, or charged for longer than the journey lasts". The
constraints below bound what counts as a defect and what counts as an honest consequence.

---

## 1. A cost is only a defect if it is charged twice, or to the wrong people

Two adults away from camp for ten to twenty days is a real subsistence cost, and a model in
which reconnaissance is nearly free would be a worse model. §12 is therefore written as a
list of *accounting* faults — double deduction, over-reservation, reservation outliving the
journey, whole-band penalties for a two-person absence — and not as a population target.

The corollary matters as much: **a correctly-charged cost must not be tuned away because
the population is lower.** If the accounting is singular and the population still falls,
the honest report is that the feature has a price, and the open question becomes whether
the *benefit* side works — not whether the price can be reduced.

## 2. Away adults still eat, and cannot forage at home

Both halves are physically true and each must be charged exactly once:

- An adult on a journey continues to consume. Counting away adults in
  `adultEquivalentDemand` is correct, not a double charge.
- An adult on a journey cannot staff a task group at home. Removing them from party sizing
  is correct, not a double charge.

What would be a defect is charging *the same absence twice* — for instance deducting the
party from local labour and then also applying a band-wide penalty for the expedition, or
deducting provisions from the food ledger and then also assuming foregone local harvest.
Whether that happens is an empirical question about the code, and the audit answers it by
tracing every reader rather than by reasoning about what "should" be there.

## 3. Provisioning is not the same thing as food

An exploratory party carries what it eats. Whether that carried food is modelled as a
deduction from a band store, as a reduction of what the party can bring home, or as a
notional budget that merely bounds the journey, is a modelling choice — but the choice must
be *stated*, because the three have very different consequences. A provision budget that
constrains journey length without ever reducing band food is a legitimate design; silently
believing it is a food cost when it is not would be an error of interpretation, not of code.

## 4. Fatigue belongs to the people who walked

A whole-band fatigue penalty derived from a two-person party's kilometres would be the
clearest possible instance of §12's "party labor suppresses the whole band instead of only
the absent workers". Residential relocation, where the entire group walks, is the case
where a band-wide movement-fatigue term is physically justified. Keeping those two sources
distinct is the constraint.

## 5. Fewer bands is not the same finding as hungrier bands

This is the methodological constraint that governs the whole checkpoint, and it is why §5
forbids unnormalized world totals and §11 forbids attributing a world-population gap to a
food cost without decomposing it.

A world containing fewer, individually-healthier bands and a world containing the same
number of hungrier bands can produce the *identical* headline population number while
having nothing causally in common. The first is an expansion/fission story; the second is a
subsistence story. Only per-band and per-working-adult normalization separates them, and
the two default maps must be allowed to differ — an average across maps that conceals
opposite mechanisms is worse than no average at all.

## 6. Amplification is real causation, but it is not the same magnitude claim

If a delayed or missing fission accounts for most of a population gap, that is still a
genuine consequence of the feature — daughters that were never founded are really absent.
But it must not be reported as though exploration consumed that much food. The distinction
matters for the repair: a direct subsistence cost is fixed in the labour/provision
accounting, while a missing-fission effect is fixed (if at all) in whatever suppressed the
split, which may be nowhere near the expedition system.

## 7. Frequency is a separate question from unit cost

A correctly-sized cost paid too often is still a defect, but it is a defect of the trigger,
not of the accounting. §13 requires measuring the actual cadence against real band state
before adding any suppression, and forbids a generic timer as the first response. The
legitimate suppressors are all facts the band already holds: a party already away,
insufficient labour, an inability to provision a safe return, a heading that has repeatedly
failed, or enough viable frontier evidence already in hand.

**Open question carried forward, still unresolved.** The current model makes hunger
*increase* willingness to explore. A labour-budget argument predicts the opposite. This has
now been flagged across three checkpoints without being settled, and it should be settled
with evidence before any cadence tuning is attempted in either direction.

## 8. Explicitly NOT calibrated here

No empirical claim is made about real forager exploration frequency, party size, journey
duration, or provisioning rates. The constants remain engineering bounds inherited from
CORRECTION-17. This checkpoint changed no coefficient, no threshold, and no yield.
