# CORRECTION-15 — research constraints on human viability, recovery and resilience

Research constrains the *shape* of mechanisms this simulator may represent. It does not
authorize copying coefficients, and no single ethnographic society is encoded as the
universal human pattern. Every row below records what the simulator may plausibly
represent, what must not be universalized, and whether the mechanism exists in production
today or remains roadmap debt.

Sources are cited by author and title. Where a source's quantitative values are debated or
context-specific, only the qualitative constraint is adopted.

---

## R1 — Local forager populations can grow; global long-run growth is near zero

**Source.** Gurven & Davison, *Periodic catastrophes over human evolutionary history are
necessary to explain the forager population paradox* (PNAS, 2019).
<https://pmc.ncbi.nlm.nih.gov/articles/PMC6600907/>

**Finding (qualitative).** Contemporary and ethnographically observed forager populations
frequently show clearly positive intrinsic growth over decadal spans, which is
irreconcilable with the near-zero long-run growth implied by the archaeological record
*unless* periodic, severe mortality events (epidemics, violence, environmental failure,
local extinction) intermittently remove the accumulated gains. The paradox resolves through
**episodic catastrophe**, not through permanently suppressed fertility.

**What the simulator may represent.** Favorable periods may produce visible positive growth
and real demographic expansion. Long-run restraint may emerge from shocks, local
extinctions, and habitat limits rather than from a permanent near-zero growth rate baked
into vital rates. A band in genuinely good country over a favorable stretch should be able
to grow at a rate that is *visible over decades*, not a rate indistinguishable from zero.

**What must not be universalized.** No specific growth rate, doubling time, or catastrophe
frequency is adopted. The simulator must not schedule catastrophes on a timer, and must not
grant growth that its own physical food pipeline did not supply.

**Production status.** The growth side exists (CORRECTION-13's `nutritionalSurplus` →
fertility). The *episodic catastrophe* side exists only as ecology-driven shocks and acute
risk; epidemics and violence are roadmap debt. This checkpoint therefore tests whether
favorable conditions can grow at all, and does **not** add a catastrophe generator.

---

## R2 — Mobility and demand sharing buffer unpredictable returns

**Source.** Lewis, Vinicius, Strods, Mace & Migliano, *High mobility explains demand sharing
and enforced cooperation in egalitarian hunter-gatherers* (Nature Communications, 2014).

**Finding (qualitative).** High residential mobility and fluid camp composition make
food-sharing obligations enforceable and stable: individuals who fail to share can be left,
and those facing a poor day can move to a better-provisioned camp. Sharing and mobility are
coupled — the *option to move between social units* is part of what makes buffering work.

**What the simulator may represent.** Mobility as a real buffer against local, short-term
return variance. Camp/band composition flexibility as a mechanism, if and when persistent
inter-band relationships exist.

**What must not be universalized.** Demand sharing is not a human constant, and its
enforcement mechanism is specific to the studied societies. The simulator must not
implement "cohesion → survival bonus".

**Production status.** Residential mobility exists and is causal. **Inter-band food sharing
does not exist** — there is no transfer of physical food between bands. This is recorded as
roadmap debt; CORRECTION-15 must not fake it with a scalar.

---

## R3 — Forager social networks include kin and non-kin and carry cooperation and information

**Sources.** Apicella, Marlowe, Fowler & Christakis, *Social networks and cooperation in
hunter-gatherers* (Nature, 2012); Migliano et al., *Characterization of hunter-gatherer
networks and implications for cumulative culture* (Nature Human Behaviour, 2017).

**Finding (qualitative).** Hadza and Agta/BaYaka network structure shows cooperation
clustering within camps, assortment on cooperative tendency, and multi-level networks
spanning camps that transmit information as well as material support. Non-kin ties are
substantial. Network structure affects both cooperation and the diffusion of knowledge.

**What the simulator may represent.** Inter-band contact and information transmission
affecting what a band knows and trusts; cooperation as something with a concrete mechanism
(labor, care, information, movement), not a global modifier.

**What must not be universalized.** Specific network topologies or cooperation rates.

**Production status.** Contact memory, reported knowledge, and information distortion exist.
Whether they *causally* alter viability is exactly what §10 of this checkpoint measures
rather than assumes.

---

## R4 — Juvenile survival is variable; adult survival is buffered

**Sources.** Gurven & Kaplan, *Longevity among hunter-gatherers: a cross-cultural
examination* (Population and Development Review, 2007); Jones and colleagues' comparative
small-scale-society life-history work; Walker et al. (2006) on growth and life history.

**Finding (qualitative).** Mortality in small-scale societies is strongly age-structured:
infant and juvenile mortality is high and highly variable across societies and periods,
while adult mortality is comparatively low and flatter across much of adulthood, and
appears buffered by social and behavioral means (provisioning, care, cooperative
acquisition). Adults are not simply scaled-down versions of the same hazard.

**What the simulator may represent.** Cause- and age-differentiated mortality: dependents
more exposed to nutritional and acute shocks, working adults comparatively resistant to
*ordinary* stress but vulnerable to severe, sustained deprivation and to hazardous
activity. Adult labor loss should be causally consequential.

**What must not be universalized.** Specific life tables, life expectancies, or infant
mortality rates.

**Production status.** `advanceAgeCohorts` allocates already-decided deaths across cohorts
with food-shaped dependent/adult shares, and elder mortality is biased high. It is an
*allocation* of a single net rate, not independent age-specific hazards — a documented
structural limitation (CLAUDE.md §10.3). CORRECTION-15 checks whether ordinary stress is
too sensitive on the adult side, without introducing independent hazards (that is the
aggregate-hazard rewrite, still roadmap debt).

---

## R5 — Resilience means resisting *and* recovering from disturbance

**Sources.** Archaeological and socio-ecological resilience literature (e.g. Redman,
*Resilience theory in archaeology*; Bradtmöller, Grimm & Riel-Salvatore on resilience and
adaptive cycles in prehistoric populations).

**Finding (qualitative).** Resilience in human systems has two distinct components:
resistance (absorbing a disturbance without state change) and recovery (returning to a
viable state afterwards). Systems that can absorb a shock but never recover are not
resilient; repeated moderate disturbance is normal and survivable, and adaptive responses
typically appear *before* structural collapse.

**What the simulator may represent.** A recovery basin: bands with adequate remaining
function should be able to return to viability once physical conditions improve. Historical
hardship must decay under sustained physical recovery rather than persisting as a permanent
penalty. Adaptive behavioral change should normally precede terminal demographic collapse
when a feasible response exists.

**What must not be universalized.** Any specific recovery time, or a guarantee that recovery
succeeds. Severe, prolonged, or compound disturbance may legitimately be irreversible.

**Production status.** Recovery signals exist (`seasonalRecoveryStreak`, `recoveryRelief`,
death-memory decay, adaptation/practical responses). Whether they actually *clear* under
sustained physical recovery is the central measurement of this checkpoint's recovery-basin
matrix (§8).

---

## R6 — Energetic stress suppresses fertility before it produces large mortality

**Sources.** Ellison et al. (1993) on ovarian function under energetic stress; Konner &
Worthman (1980) on nursing and birth spacing. (Carried forward from the accepted
FOOD–DEMOGRAPHY SEPARATION calibration; CLAUDE.md §10.5.)

**Finding (qualitative).** Moderate energetic stress reduces conception probability well
before it creates a large mortality hazard, and the suppression is released on recovery.

**What the simulator may represent.** The existing ordinary fertility response plus a
nonlinear severe-chronic mortality tail — already production. Reversibility on recovery is
required.

**Production status.** Implemented and preserved; CORRECTION-13's ordering
(strong > maintenance > moderate > severe) is a hard regression gate for this checkpoint.

---

## Modeling choices this checkpoint is permitted to make

| Choice | Constraint source | Permitted because | Explicit limit |
| --- | --- | --- | --- |
| Annual demographic vital rates read a year of nutrition, not one season | R1, R6 | An annual process integrating a year must observe the year; sampling one seasonal phase is a measurement artifact, not a biological claim | Seasonal behavior (movement, activity, pressure) keeps the seasonal read |
| Historical hardship must decay under sustained physical recovery | R5, R6 | Recovery is half of resilience; irreversibility must come from physical state, not from a stale accumulator | Severe/compound cases may still be irreversible |
| Adult labor loss is causally consequential and distinct from equal-sized dependent loss | R4 | Age structure is not decorative in real populations | No new independent age hazards (roadmap) |
| Mobility can buffer local variance | R2 | Already the production mechanism | No inter-band food transfer may be invented |
| Cooperation may only act through a concrete mechanism | R2, R3 | Avoids a generic resilience scalar | If no mechanism exists, report as debt |

## Mechanisms this checkpoint may NOT add

- catastrophe or epidemic generators on a schedule (R1 — the constraint is that shocks
  exist, not that this checkpoint should author them);
- inter-band food sharing or rescue (R2 — no physical transfer mechanism exists);
- generic cohesion → survival or mortality modifiers (R2, R3);
- independent age-specific mortality hazards (R4 — that is the aggregate-hazard rewrite);
- any guaranteed recovery, floor, or survival exception (R5).
