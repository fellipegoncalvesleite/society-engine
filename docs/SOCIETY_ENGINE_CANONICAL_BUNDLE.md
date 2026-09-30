# Society Engine
# Canonical Roadmap and Permanent Rules

**Bundle version:** 2026-09-29-r11  
**Project identity:** Society Engine. Legacy `Emergent Civilization Simulator` / `Human Nomad Simulator` naming is historical only.  
**Status policy:** This file contains permanent direction and roadmap order. It intentionally does **not** contain current progress markers.  
**Replacement policy:** This complete file replaces every earlier roadmap/rules bundle.

---

# 0. The Roadmap and Rules Are One Canonical Bundle

The roadmap and the permanent rules must always travel together.

Every future ChatGPT project chat, supervisor, implementation agent, reviewer, or handoff must receive both:

1. the complete permanent rules;
2. the complete roadmap.

Never load, quote, save, or update only one half.

Whenever the user, supervisor, or implementation process changes either a permanent rule or the roadmap:

1. regenerate this complete Markdown file;
2. preserve every unchanged rule and roadmap item;
3. update the bundle version;
4. give the user the new `.md` file as a complete replacement;
5. explicitly tell the user that it replaces the previous project-memory copy.

Do not provide only a patch or summary as the new authority.

Conversational memory is not a sufficient permanent store. The user-saved project-memory copy of this file is the portable authority.


A separate cumulative companion file must travel with this bundle:

```text
SOCIETY_ENGINE_CHECKPOINT_SYSTEM_RECORD.md
```

The bundle defines permanent rules and roadmap order. The companion record explains what the accepted simulator and any exact inspected active-source
snapshot actually do, checkpoint by checkpoint, and inventories predecessor/legacy systems for
future checkpoints. The companion is deliberately separate because it contains
Git-grounded checkpoint status and evolves after every accepted freeze.

Every future supervisor and implementer must receive:

1. this complete canonical bundle;
2. the current cumulative checkpoint system record;
3. the current Git authority and `docs/HANDOFF.md`.

The companion does not replace Git, accepted evidence, or the handoff. When they disagree, Git and
accepted evidence win and the companion must be corrected.

---

# 1. Never Assume the Current Roadmap Position

The roadmap intentionally contains no `CLOSED`, `ACTIVE`, `NEXT`, or similar status labels.

Before starting, continuing, auditing, or prompting implementation work, determine the current position by:

1. inspecting the authoritative Git branch, commits, evidence, and `docs/HANDOFF.md`;
2. checking the most recent supervisor-accepted checkpoint;
3. asking the user where the project currently is when Git and the handoff do not resolve it;
4. reconciling any disagreement before proceeding.

Never assume:

- the project starts at Item 1;
- an executor-reported `PASS` was accepted;
- a branch was frozen;
- the next numerical roadmap item is authorized;
- substantial existing code means the roadmap item is complete;
- the current conversation contains the latest state.

Current status belongs in Git and the current handoff, not in this permanent file.

---

# 2. Project Vision

The simulator is not:

- a scripted history generator;
- a civilization ladder;
- a technology tree;
- a sequence of historical stereotypes;
- a machine whose objective is to “reach civilization.”

It must simulate humans who:

- perceive incomplete local evidence;
- experience material and social problems;
- interpret those problems imperfectly;
- try different responses;
- succeed, fail, mislearn, copy, reject, forget, and recombine practices;
- form households, relationships, norms, roles, organizations, institutions, settlements, economies, cultures, and polities through history;
- produce divergent outcomes under different environments, memories, conflicts, materials, opportunities, and accidents.

The product is the emergence of different human histories that remain causally explainable.

---

# 3. No Universal Civilizational Ladder

Never encode a mandatory sequence such as:

```text
band
→ tribe
→ chiefdom
→ kingdom
→ state
```

Never encode automatic thresholds such as:

```text
population reaches X
→ council unlocked

population reaches Y
→ king unlocked

agriculture exists
→ permanent village guaranteed

writing exists
→ state guaranteed
```

The MVP may have a material and organizational ceiling roughly around early literate urban Bronze Age / early Iron Age complexity in some histories.

That ceiling is a capability limit, not:

- a destination;
- a rank;
- a stage;
- a universal chronological era;
- the expected outcome.

Credible histories may include:

- mobile societies that remain mobile;
- farming communities without centralized states;
- dense settlements with weak hierarchy;
- powerful ritual networks without cities;
- metalworking without political centralization;
- centralized authority without writing;
- writing used mainly for accounting without empire;
- seasonal or task-specific leadership;
- councils, assemblies, lineage authority, household autonomy, rotating leadership, several simultaneous leaders, or no permanent leader;
- settlements that grow, split, shrink, relocate, or collapse;
- societies that never develop bronze because ore, fuel, knowledge, demand, labor, or networks are absent;
- societies that resist concentration of authority;
- societies hierarchical in one domain and egalitarian in another.

Civilization must never be a Boolean, a scalar rank, or a single progression score.

Do not create universal fields such as `civilizationLevel`, `settlementLevel`, or equivalent disguised ladders.

---

# 4. Keep the Core Ontology Distinct

The following are different entities:

- Band
- Household
- Kin group
- Settlement site
- Community
- Culture
- Language community
- Economy
- Institution
- Polity
- Route or network
- Historical era

Do not collapse:

```text
population concentration
≠ settlement permanence
≠ political centralization
≠ cultural unity
≠ economic integration
≠ state capacity
≠ civilization
```

A settlement is not automatically a polity.

A culture is not automatically a band.

A polity is not automatically a state.

An economy is not automatically a market.

An era is not automatically a technology stage.

The simulator must also preserve these permanent authority separations unless a later checkpoint explicitly adds a causal bridge.

### Physical world and human knowledge

```text
physical world truth
≠ human observation
≠ human belief
≠ human interpretation
≠ technical hypothesis
≠ planned attempt
≠ physical execution
≠ physical result
≠ efficacy
≠ competence
≠ artifact possession
```

### Material chain

```text
material substance
≠ occurrence / deposit / exposed source
≠ human-recognized resource
≠ extracted raw material
≠ processed material
≠ component
≠ artifact / structure
```

### Physical geography and human geography

```text
physical feature identity
≠ perceived feature identity
≠ named referent
≠ named / cognitive extent
≠ cultural meaning
≠ customary use
≠ territorial claim
≠ jurisdiction
```

The same mountain, river, route, valley, region, cave, spring, quarry, field, monument, or ruin may be
known differently by different people or communities. Human maps, names, boundaries, sacred
associations and claims are later social/knowledge systems; they are not hidden physical truth.

### Language, culture, religion, identity, and polity

```text
language
≠ culture
≠ religion
≠ ethnocultural identity
≠ polity
```

These domains may correlate historically, but one must not be used as a shortcut writer for another.
Political conquest does not automatically replace language. Shared language does not imply one
culture or polity. Religious affiliation does not automatically define ethnicity, technical
competence, or political loyalty.

### Objective history and social memory

```text
objective event
≠ remembered event
≠ collective / social memory
≠ oral tradition
≠ political or religious foundation legend
```

The simulation may preserve objective event truth for audit and Chronicle reconstruction while later
human groups forget, simplify, contest, reinterpret, mythologize, suppress, revive or politically
appropriate their own past.

These distinctions do not require every later authority to exist now. They constrain future
architecture and migration.

# 5. Permanent Human-Realism Checklist

Every major human system, implementation checkpoint, and acceptance report must include an explicit realism checklist.

Use:

- ✅ supported and behaviorally connected;
- 🟨 partial, simplified, or weakly connected;
- ⬜ intentionally future or blocked by a missing prerequisite;
- ❌ false, decorative, disconnected, or contradicted by evidence.

Do not mark every item automatically.

For each major human system, evaluate:

- [ ] It begins from a real need, opportunity, burden, uncertainty, conflict, or recurring coordination problem.
- [ ] Humans can perceive the relevant evidence without omniscience.
- [ ] Perception is distinct from objective truth.
- [ ] Multiple interpretations are possible where appropriate.
- [ ] Multiple responses or strategies can compete.
- [ ] Different people, households, factions, roles, or subgroups may prefer different responses.
- [ ] Knowledge, material, labor, time, energy, skill, location, and risk constrain action.
- [ ] A real physical or social attempt occurs.
- [ ] Costs and benefits can differ between participants.
- [ ] Feedback may be clear, partial, delayed, ambiguous, misleading, or dangerous.
- [ ] Success is not automatic.
- [ ] Failure, dead ends, false confidence, and unintended effects are possible.
- [ ] Learning, teaching, copying, inheritance, diffusion, and recombination exist where relevant.
- [ ] Knowledge and practices can be forgotten, abandoned, contradicted, or lost with their carriers.
- [ ] Resistance, rejection, evasion, or reversal are possible.
- [ ] The result changes real behavior, capability, relationships, or material conditions.
- [ ] The system connects to other relevant simulator systems.
- [ ] Different histories can produce different outcomes.
- [ ] No hidden mandatory ladder or global unlock exists.
- [ ] State and history remain bounded and performant.
- [ ] The UI can explain how the outcome emerged and what evidence supports it.

The goal is normally to make all applicable boxes genuinely ✅ over time. An honest 🟨 or ⬜ is better than a false ✅.

---

# 6. Causal Modeling Rules

## 6.1 Separate physical fact, memory, interpretation, and culture

Never collapse:

```text
physical danger
≠ remembered danger
≠ trauma
≠ cultural prohibition
≠ material interest in remaining
```

Also distinguish:

```text
physical presence
≠ encounter
≠ recognition
≠ social access
≠ caution
≠ hostility
≠ territorial claim
```

A physical event may become memory.

A memory may influence interpretation.

Repeated interpretations may contribute to norms.

A norm may contribute to an institution.

None of these transitions is automatic.

## 6.2 Anti-omniscience

A band, household, person, institution, or polity may use only information it could causally possess.

Do not allow decisions to read:

- hidden world truth;
- unknown resources;
- remote populations without contact;
- future outcomes;
- complete genealogy when no social carrier knows it;
- invisible political or cultural state;
- global census shortcuts;
- data created only for UI or audit.

Knowledge should have, where relevant:

- a carrier;
- an acquisition path;
- confidence;
- age;
- transmission;
- loss.

## 6.3 No automatic improvement

Need may increase willingness, urgency, or risk tolerance.

Need must not manufacture:

- stamina;
- skill;
- material;
- technology;
- knowledge;
- labor;
- storage;
- carrying capacity;
- institutional capacity.

Repeated behavior does not automatically improve.

Experience may produce learning, fatigue, trauma, entrenched error, conflict, or abandonment.

## 6.4 Real authorities, not decorative labels

A system is not implemented merely because it has:

- a type;
- an enum;
- a score;
- a Chronicle entry;
- a UI label;
- a generated name;
- an unlock flag.

A system is implemented only when it has:

- a causal writer;
- a bounded state authority;
- real consumers;
- controlled evidence;
- observable consequences.

## 6.5 One authority per fact

For every important state or quantity, identify:

- who writes it;
- who reads it;
- what invalidates it;
- how it is conserved;
- how it is bounded;
- how legacy state is handled;
- how UI projects it.

When two systems both contain “ideas,” “routines,” “capacity,” “population,” “presence,” “ownership,” or another similar concept, prove that they have different responsibilities or consolidate them.

---

# 7. Ideas, Experiments, Inventions, and Cumulative Culture

## 7.1 Required practical-adaptation chain

```text
lived evidence
→ perceived practical problem
→ available technical fragments + human material/property beliefs
→ bounded candidate design hypotheses
→ selected idea / planned test
→ physical experiment or changed practice only when an execution authority exists
→ real result
→ typed interpretation
→ success, partial success, failure, false confidence, or dead end
→ routine, revision, dormancy, abandonment, inheritance, or diffusion
→ later behavior
→ possible later human or analytical classification
```

No global technology unlock.

No invention appears merely because simulation time passed.

A plan with no physical executor may remain retained knowledge, but it must not masquerade as an
underway physical experiment.

## 7.2 Keep these distinctions explicit

```text
knowing that more carrying would help
≠ having a workable carrying technique

idea for a container
≠ successful experiment

successful experiment
≠ durable learned practice

invented container design
≠ physically produced container

one produced container
≠ every party owning one

one band knowing a practice
≠ every related band knowing it

practice existing
≠ practice being maintained

practice maintained
≠ practice working in every context

historical material belief
≠ currently actionable material belief

copied design
≠ copied competence

physical material occurrence
≠ human-recognized material opportunity
```

## 7.3 Practical-adaptation authority

Practical technical adaptation has one canonical causal/history authority:

```text
band.practicalAdaptation
```

`adaptiveHuman`, old technology tags and explanatory/read-model layers may remain compatibility or
projection surfaces, but they must not become independent writers of the same practical history.

The canonical practical-adaptation authority owns, at its current aggregate resolution:

- perceived practical problem frames;
- bounded technical fragments;
- band-level human material beliefs;
- bounded primitive construction inputs;
- normalized design hypotheses;
- selected ideas and plans;
- truthful `underway` versus `blocked_by_execution` experiment lifecycle;
- typed feedback and localized revision/dead-end lessons;
- practical responses and efficacy history;
- degraded inheritance of knowledge/hints without inherited local execution proof.

Future person-level teaching, craft, production, cultural adoption, trade and metallurgy must deepen
or migrate this authority rather than create a second practical-history foundation.

## 7.4 Discovery before classification

**Permanent rule: discovery precedes classification.**

New knowledge must be represented first at the lowest causal level the simulator needs:

```text
observation
→ hypothesis
→ planned / attempted practice
→ physical result, if actually executed
→ interpretation
→ retained / revised / contradicted knowledge
→ repeated related practice
→ possible later classification
```

Never:

```text
category unlocked
→ constituent discoveries become available
```

Labels such as `metallurgy`, `medicine`, `agriculture`, `navigation`, `architecture`, `mathematics`
or similar may later exist as:

- player/debug analytical projections;
- clusters of related practices;
- local cultural categories;
- named crafts;
- occupations;
- institutions;
- scholarly/religious concepts.

Those classifications do not manufacture constituent capability.

A society may perform a coherent set of practices before it possesses any single word or social
category matching a modern analytical domain.

## 7.5 Open variation through reusable causal primitives

Do not create emergence by hardcoding thousands of named inventions, cultures, governments, or
technology recipes.

Use bounded causal primitives that can be recombined through:

- functional intent;
- mechanisms;
- component/form roles;
- material-property predicates;
- procedures and operations;
- labor;
- context;
- skill;
- social organization;
- local history;
- feedback;
- maintenance.

Candidate generation should construct a bounded hypothesis from compatible primitives and only then,
where useful, recognize that normalized design against a historical/readability/effect-adapter
template.

Preferred order:

```text
bounded primitives + human-known evidence + history/constraints
→ composition
→ normalized design identity
→ optional recognition
```

Forbidden regression:

```text
complete named catalog entry
→ candidate exists
```

Named variants may improve readability or bridge to an already-existing physical executor, but their
names do not grant effects.

Technical primitives must remain reusable across descriptive domains. High-temperature fire,
grinding, binding, bracing, cutting, coating, measuring, drying, shaping, excavation or transport may
become relevant to several later practices. A primitive is not exclusively owned by the roadmap
category that first uses it.

## 7.6 Material belief, actionability, and local revision

Stored human material knowledge is historical epistemic state, not eternal present proof.

A belief may:

- persist historically;
- lose current practical actionability when stale;
- remain uncertain after relocation;
- be reinforced by later observation;
- be contradicted locally;
- recover when newer relevant evidence legitimately supersedes an old failure.

Specific material/role/property blame requires specific evidence. Ambiguous failure must not globally
poison a material or fabricate component-level diagnosis.

Inherited material belief must retain source-place provenance and must not masquerade as current
local occurrence.

## 7.7 Social and institutional ideas are not ordinary tools

A social rule or institution must not be treated as merely another practical invention.

Institutional emergence requires something like:

```text
recurring coordination problem or conflict
→ competing proposals or habits
→ supporters, opponents, beneficiaries, and burdened groups
→ repeated collective attempts
→ obligations, expectations, roles, and enforcement
→ legitimacy, resistance, evasion, or breakdown
→ stabilized norm or organization
→ succession, transformation, fragmentation, or collapse
```

Technical competence must not be created by cultural prestige, specialist identity, office,
institutional label, historical era, or social classification alone.

# 8. Political Diversity and Institutional Emergence

## 8.1 Small-scale collective decision-making is not yet an institution

Never let “the band decided” stand in for an unexplained social authority.

Small-scale collective decisions may involve:

- competing proposals;
- unequal information;
- task-specific expertise;
- participation or silence;
- persuasion;
- temporary leadership;
- resistance;
- compromise;
- inability to reach a decision;
- mediation;
- criticism, shame, refusal, or other bounded sanctions;
- exit, avoidance, or group division.

Leadership may be temporary, domain-specific, contested, ignored, or absent.

This layer must not silently invent:

- permanent offices;
- formal voting systems;
- universal consensus;
- household heads as automatic rulers;
- hereditary leadership;
- law or state enforcement.

Durable offices, formal authority, administration, taxation, law, and succession remain later institutional possibilities.

## 8.2 Later political and institutional diversity

Never hardcode one government ladder.

Political forms should emerge from combinations of:

- task-specific expertise;
- ritual legitimacy;
- kinship and lineage;
- control of stores, routes, animals, land, labor, or records;
- defense and war leadership;
- mediation and dispute settlement;
- age and remembered knowledge;
- charisma;
- coalition support;
- household autonomy;
- factional balance;
- dependency;
- redistributive capacity;
- coercive capacity;
- norms that prevent concentration;
- mobility and exit options;
- succession practices.

A society may develop:

- one leader;
- several leaders with separate domains;
- a council;
- assemblies;
- rotating or seasonal leaders;
- emergency leadership;
- hereditary offices;
- selected specialists;
- household heads;
- lineage representatives;
- ritual and material leaders who constrain one another;
- weak leadership;
- no permanent leadership.

Do not encode “three leaders” as a cosmetic government enum.

It should emerge because three separate authority bases remain legitimate and none can absorb the others.

Institutions should include, where relevant:

- participants;
- roles;
- decision rules;
- obligations;
- benefits;
- costs;
- resource control;
- legitimacy;
- enforcement;
- sanctions;
- resistance;
- scale;
- succession;
- memory;
- failure and transformation.

---

# 9. Material and Logistical Realism

Architecture, craft, storage, transport, and production must depend on:

- materials;
- knowledge;
- labor;
- tools;
- fuel;
- maintenance;
- demand;
- environment;
- transport;
- production chains.

No magic masonry.

No free storage.

No automatic boats, packs, baskets, sledges, carts, vessels, or buildings.

Material causality must preserve:

```text
physical material exists
≠ humans encountered it
≠ humans noticed it
≠ humans distinguished a useful property
≠ humans know extraction
≠ humans know processing
≠ humans possess a produced object
```

And:

```text
rock / mineral / sediment / organic substance
≠ occurrence or deposit
≠ recognized resource / ore
≠ extracted raw material
≠ processed material
≠ component
≠ artifact / structure
```

Physical-world systems own physical truth. Human-knowledge systems own what people have actually
observed, inferred, remembered or been taught. Production systems own real extraction,
transformation, quantities, consumption and outputs.

## 9.1 Default expedition carrying rule

The default human party begins light.

It has only minimal bodily carrying capacity:

- hands;
- arms;
- ordinary personal objects;
- already justified improvised wrapping.

Containers, packs, baskets, slings, storage vessels, sledges, boats, carts, and pack animals are not automatic.

Greater carrying capacity or logistical range requires:

1. recognition of the problem;
2. relevant materials;
3. experimentation or invention;
4. learned craft knowledge;
5. real labor production;
6. successful testing;
7. maintenance and replacement;
8. transmission or diffusion;
9. actual produced items or a justified aggregate stock.

```text
no dedicated containers
→ light parties and frequent returns

simple bags, baskets, slings, or dry vessels
→ more dry load and provisions

waterproof vessels
→ reliable carried water

sledges, pack animals, boats, or carts
→ fundamentally different logistics
```

Do not treat a learned technique as universal ownership.

## 9.2 Economy begins before markets

Early economy should begin with:

- household provisioning;
- sharing;
- reciprocity;
- obligations;
- care;
- debt-like memory;
- pooling;
- redistribution;
- access rights;
- labor exchange.

Markets, money, taxation, tribute, and formal property are later possibilities, not defaults.

## 9.3 Core provisioning, food sharing, care, and dependency

A human group is not modeled adequately by dividing total production by total population.

Core provisioning must eventually distinguish:

- producers;
- dependents;
- temporarily incapacitated people;
- caregivers;
- uneven need;
- uneven contribution;
- food or material transfer;
- care capacity;
- unmet need;
- consequences for health, development, fertility, and mortality.

The early provisioning checkpoint must establish a bounded survival authority without prematurely implementing the full later household economy.

Core provisioning is not yet:

- a market;
- formal debt;
- universal equal sharing;
- household property;
- taxation;
- institutional redistribution.

## 9.4 Task groups and work parties

A task is not performed by “the band” as an undifferentiated actor.

Temporary work parties must eventually account for:

- actual participants;
- available bodies and productive labor;
- relevant skill or experience;
- risk exposure;
- leadership or coordination for that task;
- disagreement or refusal;
- carrying and logistical limits;
- responsibilities left at camp;
- departure, operation, return, abortion, failure, or loss;
- how results and information return to the wider group.

This authority must be reusable by exploration, hunting, gathering, construction, transport, ritual, conflict, and other future activities rather than being reinvented independently by each system.

---

## 9.5 Human ecology and population reality calibration

After the core survival loop has been integrated, the simulator must undergo a dedicated empirical
calibration pass before WORLD-1 deepens the already-canonical WORLD-M0 physical substrate.

The calibration question is not merely whether population growth is "fast enough." It is:

> Does Society Engine convert genuinely favorable human ecological conditions into empirically
> plausible food security, mortality, fertility, recovery and long-run population trajectories,
> while still allowing marginal and poor conditions to produce hardship, decline or extinction?

The pass must audit the full causal chain rather than tune one demographic coefficient:

```text
environmental productivity
→ physically available and accessible resources
→ what people know and can reach
→ labor / activity-range constraints
→ realized physical harvest and receipts
→ food per person / provisioning support
→ nutrition and hunger
→ mortality and morbidity pressure
→ fertility and births
→ age/dependency structure
→ births minus deaths
→ population trajectory
→ density, crowding, depletion and later feedback
```

A place that appears "rich" in a map, Habitat Potential layer or other projection is not automatically
a rich human environment. The calibration must first establish whether the underlying physical
sources are actually abundant, accessible, known, harvestable and sufficient for the resident
population. It must distinguish visual/projection richness from realized human support.

Use controlled regimes spanning very poor, poor, marginal, adequate, good and exceptionally favorable
environments, with multiple starting densities where meaningful. Include small founder/recovery
populations and long stable runs. Research should draw from demographic anthropology, human ecology,
hunter-gatherer and other small-scale population demography, historical demography, archaeology and
related empirical literature. Separate well-supported ranges from contested reconstructions and
implementation abstractions.

Do not start with a predetermined desired growth rate. User-observed anomalies are hypotheses to
reproduce, instrument and explain, not conclusions to encode. Diagnose whether any discrepancy comes
from world/resource materialization, accessibility, harvesting, provisioning accounting, hunger
classification, mortality, fertility, density effects, stacked penalties, or another causal layer
before changing behavior.

A stable population must be an emergent consequence of actual births and deaths under its material
and social conditions. Do not create a hidden carrying-capacity target at which population simply
stops growing. In a favorable underpopulated environment, positive growth must be possible when the
best available empirical evidence supports it; later slowing should arise from modeled causes rather
than a demographic attractor.

This checkpoint calibrates the connected aggregate human-ecology/survival/demographic response. It
must not pre-implement the detailed pregnancy, childbirth, birth-spacing, infant-development and
life-course authority of Item 17. It also must not fake a physical-world correction: if a sealed
WORLD-M0 source/area/ecology representation is demonstrably defective, name the concrete WORLD-M0
reopening trigger and repair that authority explicitly rather than manufacturing abstract food. If
the missing fact genuinely requires WORLD-1 detailed geology/material occurrence, record that later
dependency without pretending WORLD-1 owns baseline living-ecology materialization.

## 9.6 Metallurgy and material-transformation boundary

Metallurgy is a later causal domain, not a technology unlock and not an Item-5 recipe list.

A future metallurgy architecture must preserve a chain such as:

```text
physical occurrence
→ human encounter
→ human material/property belief
→ technical hypothesis
→ attempted thermal/mechanical process
→ actual extraction / fuel / heat / labor execution
→ physical result
→ practical interpretation and revision
→ retained local competence
→ teaching / transmission
→ artifact circulation / trade
```

The simulator must be able to represent states such as:

- metal artifact possession without production knowledge;
- production knowledge without local raw material;
- copper-bearing material without produced copper metal;
- copper and tin without automatic bronze;
- imported bronze without local smelting;
- production knowledge being lost;
- practitioners moving while artifacts or raw materials do not;
- artifacts moving without production knowledge;
- local re-testing after transmitted knowledge reaches a new material/context.

Never:

```text
metallurgyUnlocked = true
copper + tin = bronze
iron-bearing material = iron production
era/date = capability
```

When canonical geology/material occurrence, extraction, inventory, craft/production, task-level
labor, teaching/skill carriers, physical trade, construction, metallurgy, or richer
weather/material compatibility becomes real, the practical-adaptation authority must be explicitly
audited and migrated/deepened rather than bypassed.


# 10. Mobility, Presence, Shared Range, and Encounter

Physical bodies must exist somewhere.

Residential people, task parties, expeditions, migrants, and travelers must not be duplicated or disappear.

For physical-presence systems, verify:

- residential remainder;
- away parties;
- prepared parties;
- outbound, operating, returning, completed, aborted, and lost phases;
- concurrent parties;
- population conservation;
- cargo and provisions;
- catchment extraction;
- demand;
- receipt timing;
- bounded history.

Same-day completed trip history must never become current body presence.

The same-day overlap seam belongs to a future daily mobility / party-overlap / encounter authority with a real within-day consumer.

Do not add an unused same-day presence ledger merely to claim coverage.

Future work must distinguish:

- route occupancy;
- target occupancy;
- same-day co-visits;
- actual simultaneity;
- encounter admission;
- recognition;
- information exchange;
- conflict or cooperation.

Crowding is physical.

Memory is not crowding.

A remembered place may influence range recognition, attachment, caution, or claims only through the correct non-physical authority.

## 10.1 Physical use is not legitimate access

Future access systems must distinguish:

```text
physical use
≠ permission
≠ hospitality
≠ expected access
≠ tenure
≠ ownership
≠ territorial boundary
≠ sovereignty
```

Resource-access norms may emerge from repeated use, memory, invitation, reciprocal relations, marriage or household ties, seasonal practice, compensation, conflict, defense costs, exclusion attempts, and successful or failed enforcement.

Do not create territory merely because ranges overlap.

Do not jump directly from shared physical use to formal property or state borders.

---

# 11. Cultural Mobility Conservatism

Cultures may develop orientations such as “stay here,” “do not leave,” or “journeys are dangerous,” but these must not be universal or hardcoded.

Possible causes:

- deep ecological knowledge;
- safe, sacred, or ancestral attachment;
- failed journeys;
- deaths, injury, loss, or conflict memory;
- sunk investment;
- fear of unknown groups;
- elder authority;
- burial or ancestor obligations;
- weak external knowledge;
- material interest in remaining.

Possible opposing groups:

- youth;
- scouts;
- migrants;
- low-status or land-poor households;
- successful travelers;
- excluded kin;
- ambitious specialists.

The orientation must be reversible through:

- crisis;
- successful expedition;
- leadership change;
- immigration;
- generational turnover;
- legitimacy loss;
- new environmental knowledge;
- collapse of local advantages.

Future UI should expose orientation, evidence, factions, debate, and change over time.

---

# 12. Life Course, Households, Residential Membership, Genetics, and Incest Avoidance

These are separate authorities and must not be collapsed into one population score or one overloaded roadmap implementation.

## 12.1 Life-course demography

Life-course systems must eventually include bounded representations of:

- age or developmental stage;
- fertility;
- pregnancy;
- childbirth;
- maternal and infant risk;
- birth spacing;
- recovery;
- childhood dependency;
- loss or substitution of caregivers;
- transition into productive capacity;
- aging;
- changing health and labor capacity.

Births must not remain a context-free population increment once this checkpoint is active.

## 12.2 Households, kinship, marriage, adoption, and co-residence

Future systems must distinguish:

```text
biological relation
≠ socially known relation
≠ household membership
≠ co-residence
≠ marriage or partnership
≠ care obligation
≠ lineage identity
```

They may include:

- known parent and sibling relations;
- partnership formation and separation;
- household formation and dissolution;
- adoption, fosterage, and shared care;
- residence rules;
- marriage or partnership between groups;
- conflicting household and wider-group obligations;
- partial socially carried kin knowledge.

Household, kin group, residential band, community, culture, and institution are not interchangeable containers.

## 12.3 Residential membership, visiting, and fission–fusion networks

Band membership must not remain a permanent binary assignment changed only by fission, absorption, or death.

Future systems must distinguish:

```text
visit
≠ temporary residence
≠ seasonal aggregation
≠ permanent transfer
≠ refuge / exile
≠ recruited settlement
≠ marriage transfer
≠ forced relocation / captivity
≠ return

seasonal aggregation
≠ institutional merger

change of residence
≠ creation of a new successor group

social relationship
≠ current co-residence
```

They may support:

- temporary visits;
- seasonal residence;
- joining partners or relatives;
- leaving after conflict;
- hosting outsiders;
- repeated aggregation and dispersal;
- links across several camps;
- retained relationships outside the current residence;
- movement of people without inventing a new civilization;
- refugees, fugitives, exiles, recruited outsiders and later mixed-origin communities where causal;
- forced mobility/captivity as a distinct pathway requiring its own later conflict/dependency/incorporation authorities rather than being collapsed into ordinary migration.

Roadmap Item 4 owns the physical early lifecycle of a successor group.

The later residential-membership checkpoint owns ordinary person or household movement among existing groups and regional social networks. It must not reopen Item 4 by turning every visit into a fission.

## 12.4 Population genetics and heritable variation

Population genetics must consume real reproduction and movement history rather than maintaining a disconnected mathematical population.

It must eventually include:

- simple heritable variation;
- inheritance through actual reproduction;
- gene flow through actual movement and partnership;
- bounded drift and founder effects;
- inbreeding depression;
- possible mortality, fertility, and development effects;
- loss, persistence, and recombination of variation.

Do not calculate inbreeding risk from band population alone.

Do not create an omniscient biological incest detector.

## 12.5 Incest avoidance and its distinct layers

Incest avoidance may emerge through:

- co-residence familiarity;
- known parent or sibling relations;
- learned kin-distance heuristics;
- household or lineage rules;
- marriage exchange;
- norms and taboos;
- remembered harmful outcomes.

Keep separate:

```text
biological relatedness
≠ biological risk
≠ socially known kinship
≠ learned avoidance
≠ norm
≠ taboo
≠ law
```

---

# 13. World Scale, Settlements, Agriculture, Architecture, and States

## 13.1 World-foundation strategic scale, sub-grid geography, and diffuse ecology

A strategic tile represents an area, not one homogeneous ecological point.

Any foundational world-generation / WORLD-M0 / retained WORLD-1 architecture must explicitly define:

- physical units and map scale;
- what variation exists inside a strategic tile;
- how geology, relief, soils, drainage, moisture, sediment, and microtopography create internal habitat mosaics;
- how those mosaics aggregate into the strategic terrain, movement, material, plant, fauna, aquatic, and water surfaces used by later systems;
- which quantities are concentrated at identifiable patches and which are diffuse across a wider range;
- how mobile fauna ranges differ from fixed plant or aquatic sources;
- how generation thresholds, spacing rules, and global caps scale with map area and habitat opportunity.

The simulator must not confuse:

```text
no concentrated patch materialized on this tile
≠ no terrestrial ecology exists anywhere inside the represented area
```

Nor may it confuse:

```text
habitat potential
≠ currently available physical food
```

Non-river plains must not be universally fertile, universally survivable, or universally empty.
Depending on soils, moisture, season, microdrainage, vegetation, fauna, knowledge, mobility, labor,
and population demand, they may be:

- currently impossible to occupy;
- marginally survivable for small or mobile groups;
- seasonally productive;
- usable only through a wide activity range;
- dependent on sparse water points or temporary creeks;
- locally productive but unreliable;
- unable to support large or sedentary populations.

Rivers, floodplains, wetlands, lakes, deltas, and coasts may remain denser, more diverse, and more
reliable. They must not become the only places where a region hundreds of kilometres wide contains
physical terrestrial food merely because point-source materialization, spacing rules, or fixed
whole-map caps erase diffuse plains ecology.

The chosen world foundation must preserve the accepted Living Ecology principle:

```text
physical source
→ physical extraction or use
→ physical receipt or embodied effect
```

It must improve the substrate and aggregation feeding that architecture, not replace it with a
universal background-food floor, make `Habitat Potential` feed people directly, or paint decorative
green without a physical source.

Required world-foundation evidence must include:

- a map-scale and unit audit;
- a strategic-tile versus internal-mosaic contract;
- source-density and cap sensitivity across different map areas;
- sampled non-river plains across soil, moisture, season, and aridity classes;
- controlled cases where some plains are impossible, some marginal, and some seasonally viable;
- proof that river corridors remain advantaged without monopolizing all terrestrial support;
- proof that no support appears without a physical plant, fauna, aquatic, water, or later justified diffuse-resource authority;
- human consequences showing that plains survival, where possible, requires appropriate range,
  knowledge, mobility, labor, and population scale rather than a free terrain bonus.

A chosen world foundation must be integrated as an explicit extension/migration of accepted ecology authorities, not installed as a decorative parallel world. A correction to scale-dependent
materialization or aggregation does not authorize rewriting physical receipts, anti-omniscience,
resource conservation, or already frozen human-location invariants.

## 13.1A WORLD-M0 canonical foundation program

The Item-5.5 architecture gate inserts **WORLD-M0** immediately after Item 5.5 and before Roadmap
Item 6. WORLD-M0 is a foundation program with its own checkpoint graph; it is not a renaming of
Roadmap Item 6 and it does not renumber the later human roadmap.

The permanent WORLD-M0 order is:

```text
M0.1  Authority / Recipe / Identity / Spatial Contract
→ M0.2  Terrain + Hydrographic Physical Foundation
→ M0.3  Climate / Water / Broad Substrate / Sub-cell Foundation
→ M0.4  Canonical Living-Ecology Realization
→ M0.5  PRE-SEAL Dual-Resolution + Determinism + Physical/Ecology Certification
→ M0.6  Bounded Convergence → Final Genesis State → Package Seal → Human-Ecology Feasibility
→ M0.7  Legacy Authority Cutover + Items 1–5 + SCALE-1 Migration
→ M0.8  Runtime + Adversarial Closure + Final Freeze
```

Permanent WORLD-M0 boundaries:

- WORLD-M0 is a deterministic, versioned pre-human **physical-world compiler plus baseline
  living-ecology realization**, not a daily Earth-system simulator.
- There is one physical truth. Candidate WORLD-M0 state may exist in shadow, but legacy production
  physical authority remains singular until the one-way M0.7 cutover.
- The intended nominal strategic resolution is 1.0 km, but resolution remains recipe-bearing and is
  not certified/frozen until M0.5. A different cell count is allowed; different physical semantics
  are not.
- WORLD-M0 inherits frozen SCALE-1 physical-unit semantics for distance, area, coordinates, edge
  length, traversal, travel time, crossings and physical reach. Raw cell count is never physical
  authority.
- Persistent representation is hybrid and bounded: strategic grid + bounded statistical sub-cell
  mosaic + vector/graph hydrography + sparse concentrated features + diffuse reservoirs + aggregate
  mobile ranges. Do not install a dense permanent fine sub-grid under every strategic cell.
- WORLD-M0 owns quantitative climate/hydrologic **normals** and broad causal substrate needed for a
  coherent initial world. Item 12 remains the later authority for actual weather, storms, drought
  sequences, flood events, wildfire and current weather history.
- WORLD-M0 broad geology/substrate is not detailed mineral/resource occurrence. WORLD-1 later
  deepens formations, facies, outcrops, occurrence/deposit geometry, grade/concentration, exposure,
  depth, extractable stocks and longer-term physical landscape/material history through explicit
  migration/versioning rather than a second world.
- WORLD-M0 realizes canonical baseline living-source geometry as concentrated, diffuse and mobile
  physical authorities. Habitat potential, biome, terrain labels, `resourceProfile` and carrying
  capacity remain non-food projections; human nutrition still requires physical source use/extraction
  and the accepted receipt path.
- WORLD-M0 hidden physical truth must never directly write human observation, belief, memory, route
  knowledge, `HumanMaterialBelief`, practical adaptation, recognized-resource state or competence.
- M0.6 ordering is binding: convergence first, then final `genesisEnvironmentState`, then final
  package seal/`packageDigest`, then human-ecology feasibility against that sealed package. No
  post-seal feasibility step may mutate the package it evaluates.
- M0.7 migration is a provider migration for Items 1–5 and SCALE-1, not permission for silent
  semantic redesign. A frozen checkpoint reopens only through its established concrete reopening
  criteria.
- The final `WorldM0Package` and its certification bundle are distinct authorities. Certification
  references the sealed package digest; certification evidence is never part of the package identity.

The full normative implementation and certification contract lives in the repository's canonical
WORLD-M0 architecture specification. This portable bundle preserves the roadmap placement and the
permanent cross-system rules that future architects must not lose.

## 13.2 Small-scale society integration gate

Before settlement morphogenesis begins, the simulator must prove that its small-scale human systems form a connected society rather than a collection of isolated modules.

The gate must inspect whether people can, through connected authorities:

- be born, develop, age, and die;
- receive care and provisioning;
- form and leave households;
- know some relations without omniscient genealogy;
- visit, join, leave, aggregate, and disperse;
- form temporary task groups;
- share, refuse, reciprocate, or fail to provide;
- teach, learn, forget, and lose carriers;
- cooperate, disagree, mediate, sanction, and exit;
- form and revise norms;
- negotiate access and hospitality;
- fission, return, dissolve, or persist;
- retain bounded memory across these processes.

This is a local integration gate before settlement systems.

It does not replace the final whole-simulator missing/disconnected architecture audit, which must remain last.

No universal:

```text
camp
→ village
→ town
→ city
```

Settlement morphology must emerge from:

- repeated residence;
- household placement;
- paths;
- water;
- waste;
- fire;
- storage;
- work areas;
- defense;
- topography;
- land use;
- structures;
- rebuilding;
- decay;
- property or access rules.

Agriculture and pastoralism do not automatically create settlements or states.

States require real capacities such as:

- record keeping;
- durable authority;
- surplus capture;
- redistribution;
- taxation or tribute;
- public works;
- enforcement;
- administration;
- military or coercive organization;
- territorial reach;
- transport and communication;
- legitimacy.

A state may fail, fragment, contract, or never form.

---

# 14. Historical Eras, Chronicle, and UI

Eras must be detected from historical patterns, not chosen from a universal age list.

Era names should derive from:

- dominant changes;
- remembered events;
- settlements;
- institutions;
- conflicts;
- migrations;
- technologies;
- ecological shifts;
- political transformations.

Historical authority must distinguish:

```text
objective engine event
≠ what a person remembers
≠ collective/social memory
≠ oral tradition
≠ political/religious foundation legend
≠ later historian/Chronicle classification
```

The engine may preserve objective physical history for audit while later simulated people forget,
contest, simplify, mythologize or reinterpret it.

Chronicle rules:

- the Chronicle/historical wiki is a read model over causal records and later memory authorities; it must never become the writer of what simulated societies remember;
- the default landing layer must be compact and scannable;
- named episodes, chapters, and events should usually begin as:
  - title;
  - date or range;
  - type/category;
  - one-line meaning;
  - a few evidence chips;
- full prose and causal proof should be expandable or deeper;
- do not dump every event description into the main interface;
- major articles may be rich;
- hierarchy, meaning, and navigability come first;
- evidence remains available on demand;
- prefer significant events over noise.

History/UI prompts should inspect reference patterns from museums, archives, encyclopedias, historical websites, and long-form history layouts before choosing a design.

---

# 15. Time Control

Internal time modes may remain:

- daily = 1 day;
- weekly = 7 days;
- monthly = 30 days;
- seasonal = 90 days;

provided all advance through the same daily causal kernel and remain equivalent.

Future public playback should normally expose only:

- Day;
- Season.

Season should simulate ninety daily days faster, not use another causal model.

Do not mix time-control UI work into unrelated checkpoints.

## 15.1 Physical clock versus cultural calendars

The simulator's physical clock and human cultural calendars are different authorities.

The physical world may retain an Earth-like orbital year and deterministic day/season chronology as
the objective environmental clock used by the simulation kernel. A culture's calendar is a later
human system for naming, grouping and interpreting time.

Future cultures may:

- use different calendars at the same physical time;
- share a calendar across communities;
- reform, replace or abandon a calendar;
- reckon years from different remembered events;
- maintain overlapping ritual, seasonal, administrative or political chronologies;
- disagree about dates or era boundaries where their knowledge permits it.

A cultural calendar must not change orbital seasons or physical elapsed time. A physical year must not
automatically become one universal in-world calendar. When cultural chronology exists, the public
experience may allow the user to follow any chronology causally known to the relevant culture while
still preserving an objective simulation clock for audit and determinism.

Historical era detection remains separate from both authorities: eras summarize historical patterns;
they are not automatically calendar systems or physical climate stages.

---

# 16. Research and Design Method

Before every major design, audit, or architecture-heavy implementation prompt:

1. inspect current Git authority and actual behavior;
2. read the complete canonical roadmap and permanent rules;
3. inspect the current cumulative checkpoint/system record;
4. identify the real problem, symptoms and evidence;
5. inventory existing authorities, writers, readers, projections and legacy/predecessor systems relevant to the work;
6. perform past-system impact analysis;
7. perform future-system dependency analysis;
8. identify migration, replacement, extension and reopening requirements;
9. ask what information future systems would need that the current design might destroy;
10. brainstorm how the human phenomenon may emerge;
11. research relevant academic literature and reference systems where useful;
12. compare alternative causal models;
13. identify prerequisites and forbidden shortcuts;
14. choose the smallest expandable architecture;
15. define controlled causal fixtures and negative controls;
16. test natural occurrence and unintended effects;
17. verify boundedness, determinism, performance and state size;
18. perform a cross-system back-propagation audit after substantial changes;
19. explain the human result before the technical verdict.

Every report must distinguish:

- supported mechanism;
- plausible interpretation;
- contested theory;
- implementation abstraction;
- deliberate simplification;
- deferred seam.

Do not present a contested theory as settled fact.

Do not turn one ethnographic or historical case into a universal rule.

User examples are research leads and stress tests, not automatic architecture requirements. A major
audit must actively search for important omitted systems that neither the user nor the previous
architect named.

### Cross-system impact and back-propagation rule

Every roadmap item is a modification to one evolving simulator, not an isolated feature added beside
it.

Before implementation, explicitly ask:

> Which accepted systems does this work consume, deepen, replace, or require migration of?

After implementation or correction, explicitly ask:

> What assumptions elsewhere became false now that this system exists or changed?

Trace new facts through:

- canonical writers;
- behavioral readers;
- caches;
- projections;
- histories;
- inheritance/transmission;
- UI/debug readers;
- frozen authority boundaries;
- future dependency seams.

For each affected older authority classify the outcome as:

```text
extend
migrate
replace
retain behind compatibility adapter
prove unaffected
defer to a named future authority
```

Do not create a second load-bearing authority merely because migration is inconvenient.

Do not use back-propagation as permission for an unbounded repository redesign. Fix consequences
owned by the current checkpoint and record dependencies that require a later authority.

### Permanent architecture-review questions

Every substantial architecture review must ask:

- Could a plausible future behavior require information this system permanently throws away?
- Can a future deeper authority migrate this state without fabricating historical facts?
- Does this proposal create a second authority for a fact already owned elsewhere?
- Does a descriptive roadmap category accidentally become a causal unlock?
- Are physical truth, human knowledge, execution, result, competence and projection still separated?
- Are historical consequences persistent enough for later systems to consume?
- Can disagreement, uncertainty, partial knowledge and error exist where appropriate?
- Is important causal state observable/debuggable without making the UI a writer?

# 17. Prompt Design Rules

Every new architecture-heavy implementation chat must be assumed to have **zero prior conversation
context**. This is a prompt-completeness requirement, not a requirement to start a new chat for every
prompt. Same-chat continuations must restate the exact active scope, verified authority, changed
rulings and stop condition, without repeatedly pasting the entire portable archive. A new owner or an
independent reviewer receives a complete self-contained handoff.

The supervising architect must therefore produce a self-contained prompt containing, as relevant:

- difficulty label (`EASY`, `MEDIUM`, `HARD`, `VERY HARD`, or `EXTREME`) appropriate to the actual task;
- repository;
- branch/worktree requirements;
- accepted base SHA;
- frozen prior authorities;
- exact role;
- architecture already decided;
- current verified state;
- claimed previous handoff explicitly marked untrusted until Git inspection;
- remaining work;
- canonical authority boundaries;
- invariants;
- scope and non-scope;
- forbidden shortcuts;
- migration/back-propagation rules;
- required RED/GREEN evidence;
- negative controls;
- required regressions;
- boundedness/performance expectations;
- Git requirements;
- commit policy;
- push policy;
- stop condition;
- final report requirements.

Never depend on:

```text
continue what we discussed
same as before
you know the architecture
```

without reconstructing the required context.

Every implementation prompt must explicitly say exactly one of:

```text
COMMIT REQUIRED
```

or:

```text
DO NOT COMMIT
```

When `COMMIT REQUIRED`, normally require:

- all intended changes committed;
- staged diff inspected;
- clean final worktree;
- no conflicts or generated junk;
- normal human Git identity;
- no AI/model/bot authorship or trailers;
- exact final SHA;
- checkpoint branch push when independent review is required;
- upstream ahead/behind verification;
- no silent main merge;
- no implementer self-acceptance or self-freeze unless explicitly authorized.

### Architect versus implementation responsibilities

The supervising architect owns consequential architecture.

The implementation engineer should not be told to rediscover or choose high-level architecture
unless the task explicitly assigns an architecture/brainstorm role.

An implementation prompt should state the chosen architecture clearly enough for a weaker/local model
to execute it while still requiring the implementer to:

- inspect real code;
- make local engineering choices;
- write tests;
- identify contradictions;
- challenge false assumptions with evidence;
- stop at unresolved architectural boundaries.

User examples remain seeds/stress tests, not exhaustive specifications.

Major architecture passes must search for omitted causal systems.

Do not silently expand scope.

Do not automatically advance the roadmap.

Deliver complete implementation prompts in one clear writing block.

## 17.1 Difficulty labels for model selection

Every supervising-project message and every worker prompt must identify its task difficulty using
exactly this scale, so the user can choose the model:

- **EASY** — acknowledgment, straightforward source extraction, or a small mechanically checkable task.
- **MEDIUM** — bounded synthesis or a localized task with limited dependencies.
- **HARD** — substantial implementation/review with several interacting requirements.
- **VERY HARD** — cross-module reasoning, difficult causal diagnosis, or architecture-sensitive correction.
- **EXTREME** — simulator-wide architectural/causal review, scientific-model adjudication, or a similarly
  broad task where a locally plausible answer can conceal a system-wide contradiction.

Rate the work being assigned, not the length of the message or the emotional importance of the issue.
A short message commissioning a game-wide review can therefore carry EXTREME. A mixed-task prompt must
label materially different slices separately when that helps model selection. These are operational
complexity judgments, not empirical guarantees about any named model or a change to acceptance criteria.
Do not invent current model prices/capabilities to justify a label.

## 17.2 Coherent execution without review churn

Prefer one bounded task contract, one coherent implementation pass, the full required regressions,
one independent material-checkpoint review, and corrections only for substantiated findings. Larger
coherent worker assignments may contain multiple authorized internal tasks, but retain their individual
evidence and acceptance gates; do not collapse Tasks 13–16 into Task 12.

Do not stack overlapping advisory reviews while a known finding is being fixed unless a new
load-bearing contradiction appears. Parallel read-only investigation is appropriate where independent;
up to eight workers may be used when actually supported by the available tools. Do not spawn workers
just to fill capacity. Keep one primary repository write owner. Parallel writing, if explicitly
approved, requires isolated worktrees, disjoint ownership and one integration owner.

Speed comes from less duplicate investigation and clearer scope, not from weakening conservation,
scientific grounding, RED/GREEN discrimination, evidence preservation or independent acceptance.


# 18. Executor Report Evaluation

Lead in human terms:

1. what happened;
2. whether it worked;
3. what changed for simulated humans;
4. suspicious or problematic parts;
5. what the user must do next;
6. technical Git/roadmap verdict;
7. next labeled prompt when authorized.

Do not accept `PASS` because the executor wrote `PASS`.

Audit:

- branch;
- HEAD;
- remote parity;
- diff;
- production code;
- evidence;
- fixtures;
- natural runs;
- regressions;
- boundedness;
- hidden assumptions;
- vacuous tests;
- unsupported claims;
- scope drift.

State whether tests were personally executed or only reviewed from published evidence.

---

# 19. Git, Checkpoints, and Evidence

No automatic merge to `main`.

No freeze without supervisory acceptance.

No force push, destructive reset, silent amend, or unrelated cleanup.

Each checkpoint should preserve:

- exact base;
- exact branch;
- exact HEAD;
- production diff;
- evidence package;
- before/after comparison;
- controlled fixtures;
- natural occurrence;
- regressions;
- performance and state size where relevant;
- known limitations;
- deferred seams;
- handoff.

Frozen evidence must not be overwritten.

A correction may add new or explicitly versioned evidence.

Main remains untouched until explicitly authorized.

## 19.1 Checkpoint closure contract

A roadmap checkpoint is a vertical update to the simulator, not a temporary sketch that later items are expected to rebuild from scratch.

A checkpoint may be frozen only when the layer it owns is behaviorally complete at the causal resolution currently available. Where applicable, closure requires:

- one explicit authority for each fact owned by the checkpoint;
- a complete bounded lifecycle rather than only creation or a success path;
- physical, demographic, material, informational, and social conservation rules relevant to that layer;
- failure, refusal, reversal, abandonment, decay, return, or loss where the phenomenon permits them;
- every load-bearing current reader classified and connected;
- natural occurrence rather than fixture-only existence;
- deterministic and bounded state;
- regression coverage for previously frozen invariants;
- explicit simplifications, unresolved evidence, and future dependencies;
- a clean handoff showing what is permanently owned and what remains future work.

A checkpoint is not closed merely because:

- types exist;
- a pure helper exists without production callers;
- one happy-path fixture passes;
- the UI can display a label;
- the executor reports `PASS`;
- a future checkpoint is expected to finish the lifecycle.

Freeze means:

> the checkpoint's core truth should normally remain valid while future systems add richer causes, actors, granularity, and consequences around it.

Freeze does not mean:

- perfect scientific realism;
- permanent implementation details;
- immunity from evidence-based correction;
- anticipation of every future system.

## 19.2 Additive extension rule

Future roadmap items must default to extending frozen checkpoints rather than reopening their foundational questions.

Permitted future extensions include:

- richer causal inputs;
- more detailed actors or carriers;
- new preferences, conflicts, norms, and institutions;
- finer demographic or material granularity;
- additional outcomes and consequences;
- new consumers of an existing authority;
- migration from an aggregate representation to a richer representation while preserving established invariants.

Future additions must preserve the earlier checkpoint's closed core unless concrete evidence proves that core false.

Examples:

```text
Item 4 closes physical fission, conservation, travel, failure, return,
reintegration, and stabilization.

Later households may change which people leave together.
Later culture may change willingness to leave.
Later leadership may change how the decision is made.
Later genetics may consume the founder event.

None may reintroduce teleportation, fabricated people, automatic success,
or an unresolved successor.
```

```text
Shared physical use may later acquire hospitality, tenure, claims, law,
or sovereignty.

Those later layers do not rewrite whether bodies were physically present.
```

```text
A future knowledge-carrier system may replace aggregate knowledge transfer
with transmission by actual people.

It must preserve the earlier truth that unknown information cannot be copied
and that transmission may degrade or fail.
```

When a richer future representation replaces an aggregate one, the implementation must publish a migration map showing:

- which earlier invariant remains unchanged;
- which earlier abstraction is being refined;
- which fields or authorities are retired;
- how old and new evidence remain interpretable;
- which regressions prove that the refinement did not reopen closed defects.

Do not preserve a proven defect merely for trajectory compatibility. Backward compatibility applies to valid authority and evidence, not to known false behavior.

## 19.3 Frozen-checkpoint Future Evolution Contract

Every final freeze package must include a compact **Future Evolution Contract** containing:

- **owned facts** — what this checkpoint is now the canonical authority for;
- **permanent invariants** — truths future work must preserve;
- **current simplifications** — deliberate abstractions accepted at this stage;
- **extension seams** — explicit inputs or adapters future systems may enrich;
- **deferred authorities** — future systems required before a missing detail can become real;
- **forbidden shortcuts** — tempting but false ways later work must not use;
- **reopening triggers** — concrete future authorities or evidence that require deliberate migration/correction;
- **non-triggers** — reasons insufficient to reopen it;
- **dependency direction** — which later systems consume, deepen, or require migration of this authority.

The contract is not a claim that every future connection has been predicted. It exists so later work
adds onto a known foundation instead of silently inventing a second foundation.

When a later roadmap item activates a named reopening trigger, it must perform an explicit dependency
audit. Do not silently swap an adapter or backfill richer truth into old human knowledge/history.

## 19.4 Reopening a frozen checkpoint

A frozen checkpoint may be reopened only through an explicit correction boundary approved by the supervisor and user.

Valid reopening triggers include:

- a conservation or ownership invariant is violated;
- two authorities independently control the same fact;
- a future required connection cannot be expressed without contradiction;
- natural simulation produces a clearly false or structurally impossible outcome;
- the implementation relies on hidden or omniscient information;
- boundedness, determinism, serialization, or performance fails at the required scale;
- frozen evidence is discovered to be vacuous, mislabeled, corrupted, or based on a defective instrument;
- a scientific or domain assumption central to the mechanism is shown to be materially wrong.

Insufficient reasons include:

- a newer model prefers a cleaner style;
- another implementation would be more fashionable;
- speculative future-proofing without a current contradiction;
- unrelated cleanup;
- a desire to generalize every interface preemptively;
- minor trajectory differences;
- discomfort with an honest simplification that remains inside its declared boundary.

A reopening must:

1. name the exact defect;
2. identify the original checkpoint authority;
3. bound the blast radius;
4. preserve the old frozen evidence;
5. add versioned correction evidence;
6. prove the corrected mechanism and all affected regressions;
7. update the extension manifest;
8. re-freeze explicitly;
9. return to the current roadmap item without turning the correction into open-ended redesign.

Do not hide a foundational rewrite inside a later checkpoint.

## 19.5 Legacy-system review policy

The repository may contain older systems that are shallow, disconnected, over-aggregated, or behaviorally false. The project must repair them deliberately without pausing the roadmap for an unbounded whole-repository rewrite.

For each roadmap checkpoint:

1. inspect the existing legacy behavior that claims to implement or feed that checkpoint;
2. measure it before redesigning it;
3. preserve what is already causally correct;
4. replace false or disconnected load-bearing behavior inside the checkpoint that owns it;
5. record unrelated defects in the correct future checkpoint or integration gate;
6. do not modernize unrelated code merely because it was discovered nearby;
7. do not preserve a measured defect merely because previous simulations depended on it.

This means old systems are revised progressively as their authoritative checkpoint opens.

The intended pattern is:

```text
legacy feature is measured
→ checkpoint identifies its real authority and defects
→ checkpoint replaces the false core
→ checkpoint freezes a stable extension contract
→ later items add onto that contract
```

Not:

```text
start every new checkpoint
→ reconsider the whole simulator
→ redesign several frozen systems for elegance
→ confuse roadmap ownership
→ never finish the current item
```

## 19.6 Integration gates do not excuse partial checkpoints

Roadmap Item 5.5 is a mandatory post-foundation architecture/dependency gate. Roadmap Items 10, 28,
and 44 are deliberate integration and architecture review points. These gates concentrate
cross-system review so ordinary checkpoints do not become permanent global audits.

However:

- Item 5.5 does not automatically reopen Items 1–5 or authorize every audit lead; concrete migration
  follows only from the gate's evidence/user-approved roadmap decision and the frozen checkpoint
  correction rules;
- Item 10 does not excuse leaving survival-level systems incomplete;
- Item 28 does not excuse leaving households, membership, language, relations, decision-making, culture, or access as disconnected labels;
- Item 44 does not excuse knowingly freezing false foundational behavior.

An integration gate may reopen a frozen checkpoint only through the explicit evidence-based correction procedure above.

---


## 19.7 Cumulative checkpoint system record

The project must maintain one cumulative explanatory file:

```text
SOCIETY_ENGINE_CHECKPOINT_SYSTEM_RECORD.md
```

Its purpose is to let a human or a stronger future model understand the accepted simulator and the
currently inspected active source well enough to locate contradictions, duplicated authorities,
shallow legacy mechanisms, misleading schemas, missing readers and unsafe extension points without
reconstructing the project from chat history.

It is a separate authority with a narrow role:

```text
canonical bundle
→ permanent design rules and roadmap order

accepted Git + frozen evidence
→ closed checkpoint authority

exact inspected active source + .git provenance
→ current structural facts, never automatic acceptance

checkpoint system record
→ cumulative human-readable explanation and future-item predecessor inventory
```

### Mandatory update after every checkpoint freeze

Immediately after the supervisor accepts and freezes a roadmap checkpoint, and before the next
roadmap item begins, the architect/supervisor must require the implementer to update the cumulative
record and commit that update on the accepted freeze branch or its explicit documentation/freeze
branch.

The update must contain, for the newly closed checkpoint:

- exact roadmap item and title;
- `CLOSED / ACCEPTED / FROZEN` status;
- exact production commit and freeze/certification commit where distinct;
- a plain-language explanation of what changed for simulated humans;
- the complete causal chain owned by the checkpoint;
- canonical state, writers, readers, transition authorities, invalidation and cleanup;
- natural occurrence and controlled evidence at the level needed to understand the behavior;
- permanent invariants future checkpoints must preserve;
- accepted simplifications and implementation abstractions;
- known defects, suspicious results, vacuous or not-constructed evidence;
- extension seams and deferred authorities;
- a committed Future Evolution Contract stating dependency direction;
- forbidden shortcuts;
- concrete reopening triggers and non-triggers;
- source paths and evidence paths sufficient for a future model to verify every load-bearing claim.

A checkpoint is not fully documented for handoff until this chapter exists. The next roadmap item
must not begin merely because production was frozen while the cumulative explanation remains stale.

### Exact active-source snapshots

The user may supply a complete repository snapshot, including `.git`, before a checkpoint is pushed
or frozen. The cumulative record may use it, but must label it:

```text
INSPECTED LOCAL SOURCE / UNPUSHED
```

The record must capture:

- archive or transfer SHA-256 when available;
- repository path or source form;
- branch;
- local HEAD;
- remote tracking ref;
- ahead/behind relation;
- tracked and untracked worktree state;
- whether the commit is published;
- which tests were actually rerun in the inspection environment;
- environmental failures that prevented execution.

An exact local snapshot can verify files, types, call graphs, writers, readers, zero-callers,
structural bounds and documentation drift. It cannot by itself prove natural occurrence,
determinism, performance or supervisor acceptance. Never promote `INSPECTED LOCAL SOURCE / UNPUSHED`
to `CLOSED / FROZEN` language.

### Future-checkpoint inventory

The same file must retain a chapter for every future roadmap item. A future chapter is not a design
specification and must not pretend the item is implemented. It must inventory, from the current
accepted tree and any exact inspected active-source snapshot:

- predecessor or legacy modules that already resemble part of the future system;
- what those modules actually do;
- what they explicitly do not do;
- projection-only or debug-only state that must not be mistaken for behavior;
- type-only schemas that have no production collection or lifecycle;
- duplicate or overlapping authorities likely to require consolidation;
- legacy constants, enums, fields, writers, readers and dead vocabulary that may mislead a future
  implementer;
- required pre-implementation audits and questions;
- frozen invariants from earlier checkpoints that the future item must extend rather than reopen.

The purpose is not to solve future checkpoints early. It is to prevent a future model from assuming
that an evocatively named file, enum, UI card, architecture-graph node or 2,000-line projection is
already a real system.

### Mandatory documentation-drift audit

After every accepted freeze, compare the frozen Git state against at least:

- `CLAUDE.md`;
- `AGENTS.md`;
- `docs/HANDOFF.md`;
- `src/architecture/graphData.ts`;
- the cumulative checkpoint system record.

For each document, classify current-status claims as:

```text
current and Git-consistent
historical but still useful
superseded
aspirational/documentation-only
contradictory and requiring correction
```

Do not append a new current-status paragraph while leaving a contradictory headline above it without
an explicit supersession marker. Documentation does not become true because several files repeat the
same stale statement.

### Mandatory misleading-surface audit

Each freeze update must inspect newly touched or newly relevant names for:

- zero producers;
- zero readers;
- writers with no behavioral readers;
- readers of states no writer can produce;
- enum members unreachable in production;
- type-only future scaffolds;
- projection-only modules with behavior-sounding names;
- defaults that imply capability, health, storage, settlement, technology or institutional state;
- parallel fields that appear to describe one fact but have different writers/constants.

The result must say whether each surface is active authority, read model, compatibility state,
dormant vocabulary, future hook or defect. A future checkpoint must never claim an old field merely
because its name matches the desired concept.

### Source and confidence policy

The cumulative record must distinguish:

- **verified closed behavior** — accepted production code and frozen evidence;
- **verified published open behavior** — code present on a published branch but not frozen;
- **inspected local source / unpushed** — exact supplied source whose structure was inspected but
  whose runtime/acceptance claims remain bounded;
- **legacy/predecessor surface** — existing code relevant to a future item but outside that item's
  accepted authority;
- **projection/debug only** — readable output with no behavioral authority;
- **type-only scaffold** — schema without production ownership;
- **dormant/dead vocabulary** — zero-reader, zero-producer or unreachable naming surface;
- **future** — absent or deliberately deferred;
- **executor report only** — a lead that must not become a code claim without source inspection.

No chapter may be based solely on an executor report when the relevant code and evidence are not
published or otherwise supplied for inspection.

### Evolution-history rule

When a later checkpoint legitimately refines an earlier implementation, do not silently rewrite the
older chapter as though the new mechanism had always existed.

Update the record with an explicit evolution note stating:

- which later checkpoint changed it;
- which earlier invariant remained valid;
- which abstraction or internal authority was retired;
- why the change was additive or why an explicit correction boundary was required;
- where the versioned correction evidence lives.

The record describes the current accepted simulator and the inspected active source while preserving
enough architectural history to explain why current boundaries exist.

### Quality threshold

The record must be detailed enough that a capable future model can read it and formulate concrete
code audits. It is not a marketing summary, feature list, README or substitute for evidence.

A chapter is inadequate when it says only that a system “exists” or “is realistic.” It must expose
where truth lives, how it moves, what can fail, what remains fake or partial, which names are likely
to mislead, and which observations came from accepted evidence versus local source inspection.

# 20. Global Role Hierarchy

These roles apply in every workflow:

```text
User = final authority
Supervising architect = project mind, architecture authority and adjudicator
Implementation worker = modifies the repository under a bounded prompt
Independent checkpoint reviewer = read-only implementation/evidence reviewer
Item closure challenger = fresh read-only adversarial reviewer of architecture AND implementation
```

The supervising architect must:

- think across the whole simulator;
- inspect actual Git/evidence rather than trust reports;
- find hidden causal holes;
- prevent premature architecture;
- preserve future dependencies without implementing them early;
- decide architecture for consequential work;
- decide `PASS`, `PROGRESS`, `REWORK_REQUIRED`, `FAIL`, acceptance and freeze;
- prepare complete zero-context worker prompts;
- stop at declared/user-decision boundaries.

The implementation worker must:

- work only in the authorized repository/branch/worktree;
- inspect actual state before trusting the handoff;
- follow the current prompt;
- make local engineering choices without silently redesigning architecture;
- surface contradictions with evidence;
- not choose the next roadmap item;
- not self-accept or self-freeze architecture;
- stop/relay according to the prompt and conditional protocol.

Automated cross-chat continuation, UI copy/paste and unattended relay are **not globally active**.

They exist only inside the conditional Sentinel Relay Mode in Section 26 when the user authorizes it.

---

## 20.1 Item closure challenger

Material checkpoint code review and item-level architectural challenge are separate gates.
Checkpoint review asks whether the implementation satisfies its accepted contract. The item closure
challenger also asks whether the architect chose a defensible contract, decomposition and authority
boundary in the first place.

After an entire top-level roadmap ITEM has completed its internal work, and before full item
closure/freeze or advancement to the next top-level item, commission a fresh, independent, READ-ONLY
challenger. Provide the complete item Git range, permanent rules, accepted design and full evidence.
For a diagnosis-only item, challenge the source selection, instrumentation, attribution, conclusions
and correction recommendations rather than requiring product-code changes.

The challenger must inspect actual implementation and evidence, not only prose. Explicitly ask it to
assume the architect may be wrong, and examine assumptions, rejected/omitted alternatives, scientific
support, authority duplication, lost future information, migration feasibility, natural behavior,
fixtures, mutation execution, wrong-but-consistent producer/validator pairs and operational bounds.
It must not edit/fix code, accept its own work, or become a replacement architecture authority.

The supervising architect adjudicates each finding against user intent, permanent rules, frozen
contracts, Git/source, relevant scientific evidence and dependencies. A finding may require a bounded
implementation correction, architecture correction, formal reopening, future-seam documentation,
additional research, a user decision, or a supported no-change ruling. Resolve findings explicitly
before full item closure; neither automatic obedience nor dismissal is appropriate.

This gate is triggered by top-level ownership, not every internal task. WORLD-M0 is a foundation
program with M0.1–M0.8 milestones. Whole-program closure requires the challenger. Whether individual
M0.x milestones should additionally become item-equivalent challenger boundaries remains an explicit
roadmap-governance decision; do not silently redefine it. A separately authorized takeover challenge
or DIAG-1 challenge does not change that permanent granularity or substitute for final program closure.

## 20.2 Same-chat continuation is the default

Continue in the current implementation chat unless the supervising architect explicitly requires a
fresh one. When required, say exactly:

```text
START A FRESH CHAT FOR THIS
```

Concrete reasons include independent review/challenge, major responsibility transfer, failed tool
transport, or material context deterioration. A new prompt or completed small task alone does not
require a new chat. Independent checkpoint reviewers and item challengers must not be the implementing
worker judging its own work. This rule also governs an explicitly activated relay; relay automation
itself remains dormant unless authorized.


# 21. Agent Context Deterioration and Long-Horizon Safety

## 21.1 Supported findings

Long context capacity is not the same as reliable use of every earlier detail.

Research and current Claude documentation support the following:

- model performance can degrade when important information is buried within long context;
- growing conversations accumulate prompts, replies, file contents, and tool output;
- early detailed instructions may be lost or compressed during context management;
- long active context can reduce focus even before the formal limit is reached;
- automatic compaction can omit details that appear irrelevant to the session’s recent direction;
- a fresh, curated context may outperform indefinite continuation.

These findings do **not** prove that an agent becomes steadily worse every minute.

They do justify treating long-running work as vulnerable to:

- instruction dilution;
- forgotten constraints;
- duplicated work;
- error compounding;
- false confidence;
- bad handoffs;
- scope drift.

## 21.2 Permanent safeguards

For all substantial agent work:

- permanent rules must live in files, not only early chat messages;
- use explicit checkpoint boundaries;
- write state to Git and handoff documents;
- re-read authoritative rules after compaction or session transfer;
- verify critical claims against code and evidence;
- never rely on “the agent probably remembers”;
- prefer a fresh context when the task changes materially.

Detailed automated session-management rules apply only when **SENTINEL RELAY MODE** is active.

## 21.3 Research basis

This section is informed by:

- Liu et al., **“Lost in the Middle: How Language Models Use Long Contexts,”** *Transactions of the Association for Computational Linguistics*, 2024, DOI `10.1162/tacl_a_00638`.
- Anthropic, **“How Claude Code works,”** context-window and compaction documentation, accessed 2026-08-02.
- Anthropic, **“Models, usage, and limits in Claude Code,”** 2026.
- Anthropic, **“Compaction,”** Claude Platform documentation, accessed 2026-08-02.

Operational thresholds below are project safety abstractions, not scientific constants.

---

# 22. Scope and Session Boundaries

When the user or supervisor declares a stopping boundary:

- stop there;
- explicitly state that the boundary was reached;
- do not begin the next roadmap item;
- provide a handoff when requested.

A finding outside current scope must be handled as:

```text
identify it
→ explain why it matters
→ record it in the correct future roadmap/handoff location
→ do not implement it now
```

Thinking broadly does not authorize implementing broadly.

---

# 23. Deferred-Seam Rule

A deferred seam is not forgotten work.

Every deferred seam must state:

- what is missing;
- why it is not actionable now;
- which future authority is required;
- where it belongs in the roadmap;
- which false shortcut must be avoided.

Examples:

- same-day party presence requiring a real daily overlap/encounter consumer;
- outbound provisions depending on materially produced carrying technology;
- culture and trauma requiring distinct authorities;
- sex-aware party composition depending on canonical demographic sex composition;
- caches and storage depending on persistent-place and economy systems.

---

# 24. Roadmap Governance

The roadmap is authoritative for implementation order.

It is **not** a theory that human history follows the same sequence.

No agent may:

- skip an item or mandatory architecture gate;
- silently reorder items;
- begin the next item before acceptance;
- mix major future systems into a current checkpoint;
- move the whole-simulator audit away from the final position;
- treat an item title as proof that its system exists;
- convert a roadmap category into an automatic in-world ontology or unlock.

When a missing thread is discovered:

- determine whether it is already covered, misordered, overloaded, or genuinely missing;
- place it in the correct future item or architecture gate;
- create a new item only when necessary;
- regenerate this complete bundle after any roadmap/permanent-rule change;
- give the new complete `.md` to the user.

## 24.1 Roadmap items are cumulative layers

The roadmap should normally behave as cumulative vertical development:

```text
checkpoint closes its owned causal layer
→ freeze records permanent invariants and a Future Evolution Contract
→ later checkpoints consume / deepen / migrate earlier authority
→ integration gates test the connections
→ only concrete defects or named reopening triggers justify bounded corrections
```

A later item may enrich an earlier one, but it must not silently become the place where the earlier
item's basic lifecycle is finally completed.

When planning or reviewing an item, explicitly ask:

- What accepted authorities does this item consume?
- What earlier authority does it deepen?
- Does it activate a named migration/reopening trigger?
- What foundational questions must die here and never be reopened casually?
- What future systems may add inputs or granularity without changing the core?
- What cannot be implemented truthfully yet and must remain a named deferred seam?
- What invariant will prove that a future extension is additive rather than a disguised rewrite?

The roadmap remains understandable only when each checkpoint has clear ownership and later work
layers onto it.

Roadmap items should remain comparable in architectural granularity. Put durable mechanistic
constraints in permanent-rule sections or the cumulative system record; keep roadmap lines concise.

## 24.2 Roadmap categories are development boundaries, not simulation ontologies

**Permanent rule:**

```text
ROADMAP CATEGORY
≠ AUTOMATIC IN-WORLD CATEGORY
```

A roadmap item called metallurgy, agriculture, medicine, navigation, architecture, religion,
commerce, or similar defines development/audit ownership. It does not automatically justify a
causal `MetallurgySystem`, `AgricultureUnlocked`, domain-specific discovery container, or any other
category that manufactures its constituent capabilities.

A behavior or discovery may combine knowledge originating from several roadmap systems.

Reusable technical primitives must not become exclusively owned by a later descriptive category just
because that category commonly uses them.

Higher-level categories may become real later through independent authorities such as:

- language/naming;
- culture;
- specialization;
- institutions;
- scholarship;
- ritual/religion;
- law/administration.

Those categories may organize, transmit, reward, restrict or reinterpret practices when causally
justified. They do not retroactively create the practices.

## 24.3 Discovery before classification

Technical and practical phenomena must be discovered at causal resolution before they are grouped
under higher-level labels.

Preferred direction:

```text
observation
→ hypothesis
→ attempt
→ result
→ interpretation
→ retained/revised knowledge
→ repeated related practice
→ possible classification
```

Forbidden direction:

```text
category unlocked
→ constituent discoveries become possible
```

Player/debug classifications are projections unless explicitly given a separate causal role.

## 24.4 Mandatory whole-roadmap impact analysis

Before every architecture-heavy roadmap item opens, read the entire current roadmap and permanent
rules, inspect accepted Git, and map:

- earlier authorities consumed;
- existing predecessor/legacy code;
- duplicate-authority risks;
- future dependencies;
- information that must be preserved for later systems;
- migration/reopening triggers activated by the new work.

A roadmap item is a vertical update to one living simulator, not a detached feature pack.

## 24.5 Audit leads are not conclusions

When the user or a previous architect supplies examples of potentially missing systems, treat them as
research leads.

A broad architecture audit must actively search for important omissions not named in the prompt.

Classify findings where useful as:

```text
MISSING
ALREADY COVERED
COVERED BUT TOO LATE
COVERED BUT TOO EARLY
OVERLOADED ITEM
BADLY ORDERED DEPENDENCY
REQUIRES EXISTING-SYSTEM MIGRATION
INTENTIONALLY DEFERRED
NOT NEEDED / BAD IDEA
```

Do not convert every brainstormed concern into a new roadmap item.

## 24.6 DIAG-1 — Whole-Simulator Causal Review / Terrain-to-Human-Support Diagnosis

DIAG-1 is an additional, bounded diagnostic interrupt gate inside WORLD-M0 M0.2, before Task 12
resumption. It does not renumber the human roadmap, replace WORLD-M0, move Item 10.5 calibration
forward wholesale, or replace Item 44's final whole-simulator audit.

Its purpose is to investigate the suspected pattern “good terrain behaves like poor human habitat;
exceptional terrain behaves like merely adequate habitat” while also searching for other game-wide
causal problems. This is a hypothesis, not a confirmed universal bug or a target trajectory.

The first review is READ ONLY with respect to project source, evidence, Git refs and preserved WIP.
Read the actual production/frozen lineage, not automatically main or the newest-looking candidate
branch. Inventory the production writer/reader chain and confirm which world provider humans actually
consume. Shadow WORLD-M0 defects and current human behavior require separate causal attribution.

Reproduce the named rich-environment anomaly from available source/evidence where possible. Record
unrecoverable seed/version/scenario details as unknown rather than replacing them with a convenient
scenario and claiming the original was reproduced. Trace physical source realization, knowledge,
access, task selection, labor, travel, extraction, return receipts, provisioning, nutrition, pressure,
fertility, mortality, density and population history. Separate map/UI richness, physical abundance,
accessible/known opportunity, actual food support and demographic outcome.

Broaden the review beyond this lead: inspect authority duplication, body/labor/stock conservation,
selection-versus-execution, information latency, persistent stress/action loops, stale caches,
projection/behavior confusion, failure/refusal paths and cross-system integration. Do not turn a
read-only game-wide review into an unbounded rewrite of frozen systems.

Use controlled contrasts and multiple natural scenarios, declare measures/denominators before
interpreting results, and distinguish exact code/instrument defects from calibration questions and
honest simplifications. A same-seed counterfactual must isolate the proposed mechanism; no single
favorable or unfavorable trajectory is a universal oracle. Research empirical outcome ranges only
where conclusions depend on them. Never increase fertility, yields, food support or survival merely
to make good-looking terrain produce a preferred result.

Deliver a source/evidence-backed causal diagnosis and a bounded finding register. Each finding needs
severity, confidence, exact owner/authority, reproducer or hard source argument, observed effect,
frozen-system impact, proposed correction boundary, required regressions and deferred dependencies.
Name disproved hypotheses and unresolved evidence as explicitly as confirmed defects.

Any implementation fix is a separate, explicitly approved bounded correction under the normal
root-cause → RED → minimal correct implementation → GREEN/regressions → independent review protocol.
DIAG-1 itself authorizes no production edits, retuning, merges, freezes or reconstruction of preserved
Task-12 bytes. Final diagnostic closure requires supervisory adjudication and the item challenger.
On closure, publish the outcome in the cumulative record and reconcile the next authorized boundary;
Task 12 cannot resume automatically while its own architecture blockers remain open.

Item 10.5 remains the later empirical calibration of the integrated health/provisioning/survival
system. DIAG-1 may identify real existing defects now and propose their proper correction without
pretending those later systems already exist. Item 44 remains last and still audits the completed
simulator. The interruption's active progress and exact paused Git state belong only in the
checkpoint/system record, not in this permanent bundle.


# 25. Canonical Roadmap

Status is intentionally omitted. Determine current position from Git and the current handoff.

1. Ordinary Exploration Capacity
2. Resource Investigation / Temporary Use
3. Crowding / Shared Range / Range Release
4. Dynamic Fission / Daughter Viability / Successor Groups
5. Adaptation / Ideas / Experiments / Inventions Consolidation
5.5. Post-Item-5 World Foundation / Roadmap Dependency Architecture Gate
WORLD-M0. Canonical Pre-Human Physical + Living-Ecological World Foundation (M0.1–M0.8)
DIAG-1. Whole-Simulator Causal Review / Terrain-to-Human-Support Diagnosis (interrupt gate inside M0.2, before Task 12 resumption)
6. Band Viability / Dissolution / Absorption / Extinction
7. Projection Authority / Knowledge Boundedness / Performance Architecture
8. Core Health / Injury / Fear / Trauma / Recovery
9. Core Provisioning / Food Sharing / Care / Dependency
10. Core Human Survival Integration Audit
10.5. Human Ecology & Population Reality Calibration
11. WORLD-1 — Geology / Landforms / Hydrology / Soils / Material Geography
12. Climate / Weather / Fire / Environmental Hazards
13. Mobility / Activity Range / Residential Journeys / Crossings / Watercraft and Navigation
14. Task Groups / Work Parties / Coordination / Labor Allocation
15. Persistent Human Landscape — Camps / Places / Trails / Extraction Sites / Structures / Decay
16. Material Culture / Craft / Construction / Fuel / Pyrotechnology / Production Chains
17. Life-Course Demography / Fertility / Pregnancy / Childbirth / Childcare / Aging
18. Households / Kinship / Marriage / Adoption / Co-residence / Incest Avoidance
19. Residential Membership / Fission–Fusion / Visiting / Seasonal Aggregation / Regional Social Networks
20. Population Genetics / Heritable Variation / Gene Flow / Inbreeding Depression
21. Knowledge Carriers / Teaching / Apprenticeship / Transmission / Loss
22. Language / Naming / Communication / Linguistic Divergence
23. Social Relationships / Cooperation / Reputation / Aggression I
24. Collective Decision-Making / Leadership / Mediation / Sanctions / Exit
25. Culture / Worldviews / Norms / Ritual / Place and Animal Meaning
26. Household and Communal Economy
27. Resource Access Norms / Hospitality / Tenure / Territoriality
28. Small-Scale Society Integration Audit
29. Settlement Morphogenesis
30. Human-Animal Relations / Management / Domestication
31. Cultivation / Agriculture / Pastoralism / Niche Construction
32. Intercommunity Economy
33. Institutions / Authority / Law / Property / Tax / Tribute / Redistribution / Public Works
34. Specialization / Wealth / Status / Inequality / Social Classes
35. Organized Aggression II
36. Urban Systems / Polities / State Capacity / Regional Networks
37. Writing / Accounting / Archives / Measurement Standards / Administration
38. Complex-Society Resilience and Collapse
39. Lived Events / Follow-a-Band / Follow-a-Settlement Experience
40. Dynamic Historical Periodization / Era Detection / Era Naming
41. Explorative Chronicle / Historical Wiki
42. Achievement and Milestone Table
43. MVP Experience Polish
44. Whole-Simulator Missing Threads / Disconnected Architecture Audit

The whole-simulator missing/disconnected architecture audit must remain last.

DIAG-1 is nested in the WORLD-M0 execution sequence as an interrupt, not a task scheduled after
M0.8. Its ownership and limits are defined in §24.6. All other listed items keep their existing order.

## 25.1 Boundaries of the reorganized human-band checkpoints

The following boundaries are permanent:

- **Item 5** owns practical technical epistemic/history authority at band-aggregate resolution:
  perceived problems, technical fragments, human material beliefs, compositional design hypotheses,
  selected ideas/plans, truthful experiment lifecycle, typed feedback/revision, practical responses
  and efficacy history. Physical geology/material occurrence, extraction, inventory, production,
  task-level labor, trade, construction, metallurgy, individual teaching and causal culture/adoption
  are future authorities that may require explicit Item-5 migration rather than parallel history.
- **Item 5.5** is a mandatory architecture/research gate, not an ordinary simulation feature. Its
  accepted execution required the supervisor to discuss foundational world generation/WORLD-M0 ordering
  with the user, inspect the complete roadmap and accepted Git, perform a zero-bias interdisciplinary
  gap/dependency audit, identify required migrations/reorderings, and obtain user/architect agreement
  before Item 6 implementation. That gate is now **CLOSED / RESOLVED**. Its canonical consequence is the
  explicit WORLD-M0 program immediately below; the gate itself did not implement physical-world systems.
  Any future consequential change to this placement requires the same roadmap-governance and
  complete-bundle regeneration rules.
- **WORLD-M0** is the inserted pre-Item-6 physical/living-ecological foundation program. It owns the
  M0.1–M0.8 lifecycle defined in §13.1A: identity/spatial contract; terrain/hydrography; climate/water/
  broad substrate/sub-cell representation; baseline living ecology; pre-seal dual-resolution and
  physical/ecological certification; convergence and final package seal; one-way legacy cutover with
  Items 1–5/SCALE-1 migration; and final runtime/adversarial freeze. It does not become production
  physical authority before M0.7 and it does not silently absorb Item 12 weather history, WORLD-1
  detailed material occurrence, or later human epistemic/social systems.
- **DIAG-1** owns the additional read-only game-wide causal diagnosis, focused on the suspected
  terrain-to-human-support mismatch. It is an interrupt inside M0.2 before Task 12 resumption, not a
  substitute for Item 10.5 empirical calibration, M0.2 correction/acceptance, or Item 44 final review.
- **Item 9** establishes survival-level provisioning, sharing, care, and dependency. It does not implement the full household economy of Item 26.
- **Item 10.5** owns empirical calibration of the connected human-ecology, survival and aggregate-
  demographic response across environmental regimes and population densities. It treats user-observed
  anomalies as hypotheses to reproduce and instrument, not conclusions; it may reopen an earlier
  survival authority only through measured evidence and the explicit correction protocol. It does not
  replace WORLD-M0 physical/living-ecology authority, and a proven M0 source/area/ecology defect must be
  handled through an explicit WORLD-M0 reopening rather than deferred to WORLD-1 or hidden behind free
  support. It also does not pre-implement Item 17's detailed life-course demography.
- **Item 11 (WORLD-1)** deepens the already-canonical WORLD-M0 substrate rather than creating a second
  physical world. It owns detailed geology/material geography beyond WORLD-M0's broad substrate: richer
  formations/facies, outcrops and surface geology, occurrence/deposit geometry, concentration/grade,
  exposure/depth/accessibility, finite extractable mineral stocks, detailed material transport and
  longer-term geomorphic/material evolution where justified. Any change to sealed WORLD-M0 base
  representation requires explicit versioned migration/overlay semantics. WORLD-1 must preserve
  WORLD-M0 concentrated/diffuse/mobile living-ecology distinctions and must never make habitat
  potential feed people directly or replace physical receipts with a terrain-food floor.
- **Item 14** creates reusable temporary task-group and labor-coordination authority. It does not create permanent political offices.
- **Item 17** owns life-course demography and reproductive/developmental processes.
- **Item 18** owns households, socially known kinship, partnership, adoption, co-residence, and learned incest avoidance.
- **Item 19** owns ordinary residential membership changes, visiting, aggregation, dispersal, and regional camp networks. It does not replace Item 4’s successor-group lifecycle.
- **Item 20** owns heritable variation, gene flow, drift, founder effects, and inbreeding depression grounded in actual reproduction and movement.
- **Item 24** owns small-scale collective decision-making, temporary leadership, mediation, sanctions, and exit. Durable institutions remain Item 33.
- **Item 27** owns the bridge from physical shared use to hospitality, tenure, access expectations, claims, exclusion, and territoriality. Formal property and law remain Item 33.
- **Item 28** is a local integration gate before settlement morphogenesis. It does not replace Item 44.

The roadmap remains status-free. Current progress must always be determined from Git and the current
handoff/system record.

Item 5.5 exists specifically so the old Item-6+ sequence cannot be treated as immutable after the
first five foundational items. The roadmap now records the consequential result of that gate: WORLD-M0
is inserted before Item 6 while the later human-roadmap numbering is preserved. Future audits may still
identify missing, overloaded or badly ordered dependencies, but any consequential roadmap/permanent-rule
change again requires a regenerated complete bundle before implementation resumes.

---

# 26. CONDITIONAL PROTOCOL — SENTINEL RELAY MODE

This section defines the authorized unattended architect ↔ implementer workflow.

It is dormant unless the user explicitly activates or authorizes it for a run.

## 26.1 Exact activation phrase

Preferred explicit activation:

```text
ACTIVATE SENTINEL RELAY MODE
```

A user may also explicitly authorize the same workflow in ordinary language. The supervisor must
record the activation and the maximum roadmap boundary before implementation begins.

## 26.2 Exact deactivation / stop authority

The user may deactivate the mode at any time.

Within an active run, only an explicit supervising-architect `STOP` ends the architect ↔ implementer
cycle automatically.

These are **not** automatic stop conditions:

- green tests;
- implementation completion;
- a successful commit;
- a successful push;
- an implementer saying `PASS` or `done`;
- an implementer believing the architecture is acceptable.

Checkpoint acceptance/freeze remains a supervising-architect decision.

## 26.3 Roles

```text
User = final authority
Supervising architect = project mind, architecture authority, independent reviewer
Implementation worker = modifies the repository under one complete bounded prompt
Editor/UI relay capability = transports exact reports/prompts; never decides architecture
```

The implementation worker must never substitute its own acceptance for independent architect review.

## 26.4 Mandatory roadmap boundary before unattended work

Before the first implementation prompt, the supervisor must write a maximum boundary naming:

- current roadmap position;
- maximum endpoint;
- forbidden next work;
- conditions that can stop earlier.

The boundary is a maximum, not a promise.

Do not choose open-ended endpoints such as:

```text
continue as far as possible
finish the roadmap
keep going until morning
do whatever comes next
```

A safe default is one active roadmap item or one explicitly bounded correction family.

## 26.5 One repository owner at a time

Exactly one implementation worker may own the repository/worktree at a time.

A transfer requires:

1. current worker stops active edits;
2. repository state is saved;
3. branch/HEAD/worktree status are recorded;
4. complete report/handoff exists;
5. the new worker receives one self-contained prompt.

Do not allow parallel workers to modify the same worktree.

## 26.6 Explicit fresh-chat decision

Section 20.2 applies during relay mode too: continue the existing implementation chat by default.
A continuation prompt is not itself a worker transfer. When the supervising architect requires
independence or a real responsibility/context transfer, it must explicitly say:

```text
START A FRESH CHAT FOR THIS
```

For an explicitly requested fresh editor-worker chat, its first user message begins exactly:

```text
@Github editor v3
```

The self-contained prompt follows in the same message. Same-chat continuation still preserves the
active scope, exact authority and stop conditions. Never rely solely on informal conversational memory.

## 26.7 Worker prompt requirements

The prompt must follow Section 17 and assume zero prior context.

It must include exact:

- repository and branch/worktree;
- accepted base SHA;
- role;
- architecture already decided;
- claimed handoff marked untrusted until repository inspection;
- remaining work;
- scope/non-scope;
- invariants;
- required tests and negative controls;
- Git/commit/push requirements;
- stop condition;
- complete final-report schema.

The prompt must explicitly state `COMMIT REQUIRED` or `DO NOT COMMIT`.

## 26.8 Keep the Mac awake

At the beginning of an unattended worker session on macOS, ensure:

```bash
caffeinate -dimsu
```

is running.

If one already exists, reuse it.

Do not terminate the caffeine process merely because one worker finishes its report while the
architect ↔ implementer cycle is continuing.

Leave it running until:

- the supervising architect explicitly ends the relay cycle;
- the user asks for it to stop;
- or machine/session shutdown naturally ends it.

Do not claim `caffeinate` survives reboot or shutdown.

## 26.9 Worker completion and exact report return

When the implementation worker finishes its authorized work:

1. complete all required certification;
2. commit if required;
3. push if required;
4. verify final Git state;
5. produce the complete report;
6. preserve that report exactly;
7. use available `@Github editor v3` local/UI capabilities to locate the supervising architect
   conversation;
8. paste the complete report there as a **new user message**;
9. submit it.

Do not summarize away evidence during transfer.

Do not self-review as the architect.

## 26.10 Architect review

After receiving the report, the supervising architect must inspect actual Git/code/evidence rather
than trusting the implementer report.

The architect returns one of:

```text
STOP
```

or:

```text
REWORK / CONTINUATION + a complete new self-contained worker prompt
```

or another explicit architectural decision requiring the user.

The architect may accept/freeze only when evidence supports it.

## 26.11 Continuing or transferring the worker

When the architect returns another bounded prompt, preserve it exactly. Continue in the current
implementation chat unless it expressly requires a fresh chat. If a fresh chat is required, save the
current worktree state, stop the old write owner, create the specified chat, prefix the first message
with `@Github editor v3`, deliver the complete prompt and verify transfer when possible.

```text
architect
→ current worker, or explicitly required fresh worker
→ implementation / certification / commit / push when authorized
→ exact report to architect
→ independent Git review
→ STOP or next bounded prompt
→ same-chat continuation by default; fresh review/transfer when explicitly required
```

No transfer gives two workers simultaneous write ownership of one worktree.

## 26.12 Safe UI-automation boundary

UI/local automation is authorized only for the active project relay:

- returning a worker report to the supervising architect;
- obtaining the architect's continuation when safely possible;
- creating a fresh worker chat only when the architect explicitly requires one;
- invoking `@Github editor v3`;
- pasting/submitting the exact architect prompt.

Do not use the relay permission for unrelated messages, browsing, purchases, account changes,
credentials or other activity.

If the correct architect conversation cannot be identified confidently, the UI is unavailable,
permission is lost, or transfer state is ambiguous:

```text
AUTOMATED HANDOFF BLOCKED — MANUAL CHAT TRANSFER REQUIRED
```

Do not guess.

Preserve the exact report or prompt that requires manual transfer.

## 26.13 Two portable project-memory files

The relay/supervisor portable memory consists of exactly these two project files:

```text
SOCIETY_ENGINE_CANONICAL_BUNDLE.md
SOCIETY_ENGINE_CHECKPOINT_SYSTEM_RECORD.md
```

The canonical bundle contains permanent rules and roadmap order.

The cumulative system record contains accepted checkpoint status, Git-grounded architecture
explanations, deferred seams, future predecessor inventory and immediate handoff context.

Repository Git, accepted evidence and `docs/HANDOFF.md` must still be inspected directly. They are
repository authorities, not additional portable project-memory files.

A future supervisor must read both portable files completely before issuing architecture-heavy work.

## 26.14 Context-health controls

Long sessions are not trusted merely because they still accept messages.

At every report, correction, worker transfer or major commit boundary, re-check:

- current branch and HEAD;
- current roadmap item/gate;
- maximum boundary;
- active prompt;
- completed and pending work;
- frozen evidence integrity;
- context contradictions or repeated work;
- whether any report claim was verified against Git.

Warning signs include:

- forgetting branch/base;
- repeating completed work;
- losing permanent constraints;
- treating rejected architecture as accepted;
- changing verdict criteria;
- confusing roadmap items;
- claiming tests without outputs;
- silently skipping evidence;
- broadening scope;
- increasingly generic reports.

On warning signs:

```text
stop active implementation
→ preserve Git state
→ produce a handoff
→ create fresh context
→ reload the two portable files
→ verify Git
→ resume only after authority is restored
```

## 26.15 Evidence-based fresh-context decision

Consider an explicit fresh context for major responsibility/problem changes, failed transport,
independent review, repeated evidence contradictions, or materially degraded/compacted context.
A roadmap-item change or several corrections may justify it, but neither automatically starts a new
chat. State the reason and use `START A FRESH CHAT FOR THIS` when a transfer is required. Otherwise
continue the existing chat with a compact, exact task contract.

## 26.16 Supervisor authority while the user is away

Inside the predeclared boundary, the supervising architect may:

- inspect reports/Git/code;
- reject false `PASS`;
- identify defects;
- issue bounded correction prompts;
- answer implementation questions;
- accept/freeze a checkpoint when evidence supports it;
- continue to another worker only while still inside the declared boundary.

The architect may not:

- silently extend the endpoint;
- rewrite permanent roadmap order without regenerating this bundle;
- begin work explicitly reserved for user discussion;
- accept destructive Git operations;
- hide uncertainty from the handoff.

A mandatory user-discussion gate, such as Roadmap Item 5.5, stops unattended implementation until the
required discussion/decision occurs.

## 26.17 Boundary stop / handoff

When the boundary is reached or the user must decide, the architect must stop implementation and
produce enough state for the next session without relying on chat memory.

At minimum preserve:

- actual ending roadmap position;
- accepted/frozen/open checkpoints;
- exact branch/HEAD/remote relation;
- production changes;
- evidence and verification status;
- rejected claims/failed approaches;
- deferred seams and prohibited shortcuts;
- next authorized action;
- forbidden next work;
- complete prompt amendments needed to resume.

Do not start the next architectural item merely because tools/time remain.

# 27. Required Bundle-Update Procedure

Whenever this file changes:

1. regenerate the complete Markdown;
2. update the bundle version;
3. preserve all unchanged permanent rules and roadmap items;
4. keep current progress/status markers out of this permanent bundle;
5. keep roadmap and permanent rules together;
6. preserve Sentinel Relay Mode as conditional unless the user explicitly activates it;
7. preserve the cumulative checkpoint-system-record requirement;
8. provide the full updated `.md` to the user;
9. say explicitly that it replaces the prior project-memory bundle.

The two portable files must always travel together:

```text
SOCIETY_ENGINE_CANONICAL_BUNDLE.md
SOCIETY_ENGINE_CHECKPOINT_SYSTEM_RECORD.md
```

Updating only the cumulative system record after a freeze does not by itself require a new bundle
version unless a permanent rule or roadmap item changed.

Never rely on a future chat remembering a permanent change.

# 28. Final Operating Principle

```text
The user remains final authority.
The supervising architect thinks, researches, designs and independently reviews.
The implementation worker changes the simulator under one bounded self-contained prompt.
The roadmap controls implementation order.
Permanent rules control how systems are designed.
Accepted checkpoints publish Future Evolution Contracts.
Roadmap categories do not automatically become in-world ontologies.
Discovery precedes classification.
Human history inside Society Engine remains emergent.

When explicitly authorized:
architect → current or explicitly required fresh @Github editor v3 worker → report → independent review → bounded continuation
continues until explicit architect STOP or a required user-decision boundary.
```
