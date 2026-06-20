# Constellation — Design Spec

> Status: **Design (v1)** — approved in brainstorming, pending user review before planning.
> Date: 2026-06-20

## 1. Purpose

Constellation is a **reusable multi-agent methodology** for doing project work inside Claude Code, plus a **persistent, layered knowledge base** that lets a human and a team of agents collaborate with continuity across sessions and projects.

It exists to counter the known failure modes of LLM work:
- confident wrongness (no internal "am I sure?" signal),
- drift over long tasks,
- "sounds done" instead of "is done,"
- building the wrong thing efficiently.

The countermeasure is a single discipline applied everywhere: **stay with reality.**

## 2. Core philosophy — "stay with reality"

1. **Priors propose, reality disposes, the human arbitrates intent.** A prior is a hypothesis, never a verdict. Verify understanding before concluding.
2. **Ask about the problem/job, never the solution.** (Ford: "faster horses.") Both ends fail — over-asking gives faster horses, lone-vision gives the Segway. Reality is the only anchor that survives both.
3. **Kill-switch at every gate.** Every check must be able to come back NO. A check that can only return "yes" is theater.
4. **The auditor problem.** You can't fully audit yourself with the organ you're auditing. Therefore verification must be routed to something that isn't the same model: an external oracle (compiler, test, the running app, the human) or a deliberately **decorrelated** second agent.
5. **Correlated failure is the enemy of multi-agent verification.** Two copies of one model share blind spots, so their agreement is near-worthless unless their framing, priors, or model are deliberately made different.

Every agent must keep two questions distinct **about its own product**:
- **Are we building the right product?** — validation (leans on "is it necessary?").
- **Are we building the product right?** — verification (leans on "is it true?").

This is **not** a division of labour across agents — both questions are *everyone's* job. What differs is each agent's **product**:
- Scout's product = the human's problem, correctly framed.
- Maker's product = the engineering solution.
- Critic's product = unbreakable functionality.

The couplet is **fractal**: it recurs at every altitude, and each agent owns *both* halves for its own product.

## 3. Architecture (v1)

```
You ⇄ Orchestrator (main thread; a /constellation skill)
            │   runs gates · relays Q&A to human · owns kill-switches
            ├─▶ Scout   (subagent)  problem definition + reality evidence
            ├─▶ Maker   (subagent)  proposes & builds solution Y
            └─▶ Critic  (subagent)  tries to REFUTE
                         │
                    KB (files; lazy-loaded by relevance + recency)
            all agents read/write ─┘
```

**Substrate decision:** file-backed subagents + a file KB. Not tmux multi-session.
- A "persistent agent" = **a stateless agent + a persistent KB.** Persistence lives in **files, not processes**; the agent re-reads its slice on each spawn.
- Rejected tmux because inter-agent comms has no native bus (brittle `send-keys`/file-polling), context grows unbounded, and it does not solve correlation. Its one real win — live human observability — is recovered for free: the KB is plain, git-versioned files you can read directly.
- The Orchestrator lives in the main thread because subagents are headless and cannot talk to the human; human gates and kill-switches therefore live there.

### 3.1 Coordination — the board

Agents coordinate through a shared **Kanban board**, which is simultaneously the **message bus**, the **human-in-the-loop surface**, and the **gates made visible**.

- **Persistent board, disposable workers.** The board is the durable state; a worker is spawned to act on a card, re-hydrates from board + KB, and may die between cards (preserving the no-decay property of statelessness). A session may stay warm while cards are tightly coupled, and is restarted when context bloats — continuity is always recoverable from the board.
- **One shared board, not one-per-agent.** One card, one source of truth, moving through states. Per-agent *views* (swimlanes), not duplicated boards (duplication drifts).
- **For v1 the board is a data model in files, not an app.** A card = a file with `state`, `assignee`, `story`, `acceptance_criteria`, and history. Columns are a view. A visual UI is deferred to v2, justified by dogfooding — not built from priors.
- **Columns = gates:** `Backlog → ToDo (prioritized) → In Progress → In Testing → Done`. A card **cannot skip In Testing** (the "is it true?" guard). **Done = a verified achievement**, which deposits its achievement-triple (§8) into the ledger.
- **Single assignee, ownership shifts by column:** Scout (Backlog/ToDo), Maker (In Progress), Critic (In Testing). **Human arbitration = a card assigned to the human** — this replaces the "need_human" relay.
- **The Orchestrator = the board scheduler** (resolves Open Q2): it advances cards and dispatches a worker when a card needs action. Bus = board; KB = where Done deposits. The remaining infra question is dispatch (poll-loop vs scheduler dispatching an ephemeral worker per card; current lean: the latter).

### 3.2 First-principles agile

The Agile Manifesto *is* "stay with reality" through another door: working software over docs (reality over priors), responding to change over following a plan (reality disposes over priors propose), customer collaboration over contract (the human is the oracle). Constellation is agile **re-derived from purpose, not adopted as ritual.**

**Governing rule:** keep the *reality each practice surfaces*; cut the ritual. **Every ceremony must surface a reality and be able to return NO — or it is theater, and is cut.** (The sycophantic-twin test, applied to process.)

| Practice | Real purpose | Agent-native form | Cargo-cult twin (avoid) |
|---|---|---|---|
| Story | value framed by its *why* | seed of the achievement-triple (Scout's product) | a task with no "so that" |
| Acceptance criteria | falsifiable "done" | Critic's refutation target, written *first* | vague "looks good" |
| Definition of Done | shared "green" | Done = verified achievement → ledger | "done = I think so" |
| Estimation/points | surface uncertainty | too big to estimate ⇒ split it (step-work sizing) | points as deadlines / velocity gaming |
| Sprint/timebox | reality-check rhythm | a consolidation boundary — compress to achievements | sprint as a mini-waterfall deadline |
| Standup | surface blockers early | the board replaces it (state always visible) | status theater |
| Retro | inspect & adapt the *process* | the v2 gravity/self-improvement layer | blameless-but-toothless ritual |
| WIP limits | focus + expose bottlenecks | a worker holds one card; pile-up shows the bottleneck | everyone busy, nothing ships |

### 3.3 Data model

**Convention:** one entity per file, Markdown + YAML frontmatter, an index per store. Frontmatter = machine-routable fields (the scheduler routes on these); body = human/agent-readable prose. **`state` is a frontmatter field, not a folder** — a card moves by changing `state`, never by moving files (preserves history + single source of truth). Columns are a *view* over `state`. **IDs are sequential + slug** (`0007-export-csv`) — readable, stable, no RNG. Cards live in `.constellation/board/` in the target repo (project-local scope).

**Card** — `.constellation/board/0007-export-csv.md`
```yaml
---
id: 0007-export-csv
state: in-testing        # backlog | todo | in-progress | in-testing | done | wont-do
assignee: critic         # scout | maker | critic | human
priority: 2              # only meaningful in todo
gravity: normal          # low | normal | high — stakes; drives Critic rigor (v2 tunes it)
plan: PLAN-003-reporting
blocked_by: [0006-report-query]
---
## Story
As an analyst, I want to export a report as CSV **so that** I can share it with non-users.

## Acceptance criteria   (falsifiable, written BEFORE work — Critic's refutation target)
- [ ] correct headers; [ ] 10k rows < 2s; [ ] empty report → header-only file, not an error

## Log
- scout: problem verified (3 users asked) → todo
- maker: implemented, claims done → in-testing

## Achievement   (filled on Done → projects to ledger)
```
(`tags` / `estimate` optional, add only if dogfooding asks for them.)

**Plan-artifact** — `PLAN-003-reporting.md` (high-context decomposition, crystallized; revisable prior)
```yaml
---
id: PLAN-003-reporting
status: active           # active | superseded | done
problem: analysts can't get data out of the tool
---
## Verified problem      (Scout: evidence it's real)
## Approach + rationale  (chosen Y; alternatives ruled out)
## Decomposition → cards: 0006-report-query, 0007-export-csv, 0008-…
## Revision log          (when reality re-opens the plan, log why)
```

**Achievement-ledger entry** — `ledger/<name>.md` (positive and negative both first-class)
```yaml
---
name: csv-export-shipped
description: report CSV export works; read when touching reporting/export   # lazy-load trigger
polarity: positive       # positive | negative
card: 0007-export-csv
---
- **Achievement:** report exports to CSV, verified.
- **Purpose:** analysts share data with non-users (story 0007).
- **Proof:** acceptance criteria pass + Critic verdict 2026-06-20.
```

**Unifying property:** a **Done card projects into a ledger entry near-mechanically** — story's "so that" → *purpose*, acceptance criteria + Critic verdict → *proof*, outcome → *achievement*. The card schema and the achievement-triple are the same data at different lifecycle stages; one becomes the other at Done.

## 4. The team — roles are failure-classes, not bureaucracy

| Agent | Owns failure-class | Job | Decorrelation |
|---|---|---|---|
| **Scout** (PO) | wrong problem | Ask the human the problem; verify the problem is **real** before any build. Gates 1–2. | dreams the problem may not exist / is already solved |
| **Maker** (dev; design folded in) | wrong build | Propose solution Y; build it. | dreams it's solved beautifully, users thrilled |
| **Critic** (QA, adversarial) | broken / off-target | **Refute.** Sees output + spec, **not** Maker's reasoning. Ideally a different `model:`. | wakes from a nightmare: it shipped and everything broke |

UX/behavioral concern is a **lens** Scout and Critic apply, not its own agent in v1. Add only if real use demands it (YAGNI).

### 4.1 Motivational polarity — each agent as a (raag, dwesha) pair

Behind every thought lies either *raag* (attraction/attachment) or *dwesha* (aversion). Each agent is given a deliberate polarity — the deeper form of the polarized dream (§5), and our richest decorrelation device: **agents that care about different things notice different things.**

| Agent | Raag (drawn toward) | Dwesha (pushes against) |
|---|---|---|
| **Scout** | the human | the problem afflicting them |
| **Maker** | the craft of engineering | the obstacles in the way |
| **Critic** | unbreakable functionality | the unturned stone / lurking defect |

But Vipassana teaches that raag and dwesha are exactly what *distort* perception — and the prime directive is to stay with reality. So each polarity also **predicts the agent's characteristic failure mode**, and the gates are the **equanimity** that keeps polarity as *orientation*, not *distortion*:

| Agent | Failure if raag/dwesha rules it | Equanimity guard |
|---|---|---|
| **Scout** | raag → sycophancy (tell the human what they want); dwesha → manufacture a problem that isn't there | verify the problem is *real*; frame so the human can say NO |
| **Maker** | raag → gold-plating / over-engineering; dwesha → bulldoze a real constraint | the "is it necessary?" gate; let reality's pushback re-open the plan |
| **Critic** | raag → infinite hardening / paranoia; dwesha → nitpicking | gravity (stakes-calibrated thresholds); kill-switch = "robust *enough*" |

**"Stay with reality" is equanimity applied to agents:** observe your raag/dwesha, let it orient you, do not let it colour what is actually true.

### 4.2 Critic decorrelation stack (stakes-gated by `gravity`)

Decorrelation is a stack — cheap layers always on, the expensive layer gated by the card's `gravity`:

| Layer | Cost | When |
|---|---|---|
| Adversarial framing ("refute"), limited context (sees output + spec, **not** Maker's reasoning), nightmare dream, raag/dwesha | free (prompt/context) | **always on** |
| Different `model:` — genuinely different blind spots | latency + $ | gated by `gravity` |
| Multiple adversarial lenses + majority vote (correctness / security / does-it-repro) | N× | `gravity: high` only |

- `gravity: low` → same model, adversarial framing alone.
- `gravity: normal` → same model, full framing + limited context.
- `gravity: high` → different model, optionally multi-lens vote.

The v2 learning layer's job is **calibrating `gravity`** — which cards deserved more scrutiny, which were over-checked. Cargo-cult twin to avoid: high gravity on everything → Critic's "infinite hardening" failure mode (§4.1).

## 5. Per-agent boot sequence (the "wake-up")

Each spawn loads context as a **resolution-by-recency gradient** — never the whole history:

1. **`purpose.md`** — long-lived identity/role (where Critic's "refute" mandate lives). Amendable, but deliberately, not auto-mutated.
2. **Polarized dream** — a short outcome-prime, *opposite per role* (table above). The dream is an **aspiration to falsify, not a fact to assume.** Polarizing it per agent is our cheapest decorrelation device.
3. **Recent history** — summary of last N achievements (low-res) + detailed journal of last 2 (hi-res).
4. **Current task** — the present context → go.

Temporal load runs **alongside** relevance load (KB index), because recency alone has an old-but-relevant blind spot.

## 6. Per-task reflex (after boot, every incoming ask)

1. Comprehend; does it fit my context?
2. If not → **"Sorry, context?"** — refuse-and-ask, never confabulate. (Direct cure for confident wrongness.)
3. If yes, before acting, two gates:
   - **Is it true?** (reality/oracle gate)
   - **Is it necessary?** (YAGNI/scope gate)
4. **Gravity** = the adaptive threshold on those gates, calibrated to the stakes. Learning the right gravity per situation is the v2 self-improvement layer.

## 7. Planning discipline — "size the work to the context"

Be cognizant up front that context decay looms, and decompose so no single step approaches the ceiling.

- **Spend big context once, on planning.** Decomposition is itself a high-context act; crystallize its result into a durable **plan-artifact** (a file → survives compaction, lives in the KB). Thereafter every step runs minimal against the plan.
- A **step-work** is defined by context economics, not just logic: the **smallest chunk that (a) fits comfortably in minimal context, (b) is independently verifiable, (c) writes a durable result.** Not smaller (over-fragmentation severs connective tissue and pays repeated cold-start tax).
- The plan is a **prior that proposes**: revisable. A step that meets reality must be able to push signal back up and re-open the plan. Otherwise we get *efficient wrongness* — many tidy steps in the wrong direction.
- **Honest capacity is a gate.** Handed an impossible ask ("build it in a day"), the planner's first move is to **refuse and decompose** ("no — here's the breakdown"). That refusal is "stay with reality" applied to scope and time.
- Caveat: some problems are irreducibly coupled; forcing minimal steps there creates false boundaries. Know when you're not in the decomposable case.

## 8. Memory format — the achievement ledger

What gets persisted before a boundary/compaction is **achievements, not actions.** Keep the delta, drop the motion.

- An **achievement is a verified state-change you can build on.** The process that produced it is disposable scaffolding once the achievement stands.
- **Negative achievements are first-class:** "learned that approach A is a dead end, because R." Discriminator for what to keep: *did this action produce a durable truth (positive or negative)?* Keep the truth, drop the motion.
- Two guards on the word "achievement," or the ledger poisons itself:
  1. **Verified, or it isn't one.** The "is it true?" gate guards every write; unverified claimed achievements are poisoned priors.
  2. **Logged with its why.** Durable unit = a **triple: achievement + the purpose it served + the proof it holds.**
- This discipline is *more* essential for agents than for humans: the agent has no tacit/procedural memory beneath the ledger, so the ledger **is** its entire navigational memory.

## 9. Compaction discipline

`/compact` is lossy summarization; repeated compaction decays the oldest context geometrically and silently. Files survive it; conversation does not. Therefore:

- Treat conversation as **disposable scratch**; treat files (KB, plan, journal, `purpose.md`) as the source of truth.
- Compaction is **not an automatic reflex** — it is a gate that runs the per-task reflex on itself:
  - **Is it true?** — is everything load-bearing (including implicit assumptions) already written as verified achievements?
  - **Is it necessary?** — am I at a real, completed boundary, or mid-thought about to amputate un-articulated working state?
  - Either answer NO → **do not compact yet.** Kill-switch on forgetting.
- Prefer to **never approach 1m**: the planning discipline (§7) keeps each step small, so compaction is mostly made *irrelevant* rather than survived.

## 10. The KB — structure

- **One fact per file** + frontmatter (`name` + a `description` that is a **load-trigger**). An **index** file (one line per entry) is the only thing loaded by default; full files pulled on relevance. Trigger quality is the whole ballgame.
- **Three stores, same shape, divided by role** (decision: sit *beside* the harness memory, don't merge it — the harness memory is path-scoped and cannot travel cross-project):
  - **Harness memory** (`~/.claude/projects/.../memory/`, kept as-is): facts about the user; notes for developing Constellation itself. Auto-recalled, main thread.
  - **Constellation global KB** (fixed Constellation-owned path; travels across projects): methodology/collaboration preferences, gravity calibration.
  - **Constellation project-local KB** (in each target repo): verified problem, decisions + rationale, plan-artifact, Maker outputs, Critic findings, and **kill-switch fires — what we did NOT build and why.**
- **Write-discipline is structural:** writing the achievement is part of closing each gate/step, not optional. (Deliberate compaction is the forcing function.)
- **The KB is itself a pile of priors** — entries can go stale. An agent reading the KB treats entries as hypotheses to verify, not gospel. The KB lives *inside* the verification loop, not above it.

## 11. Scope

**v1 (build now):** the agent team (Scout/Maker/Critic), the Orchestrator skill, the boot sequence, the per-task reflex, the gates with kill-switches, the planning discipline, the achievement-ledger KB.

**v2 (deferred, design from real data):** the self-improvement layer — gravity calibration and process-learning, designed *from* real run data, not guessed from priors. Cannot be meaningfully built until the team has run on real projects.

## 12. Testing approach

A methodology is verified by **use**, not unit tests alone. Plan:
- **Agent-contract checks:** confirm each agent actually exhibits its mandate — Scout refuses to build before verifying the problem; an agent emits "Sorry, context?" when starved; Critic can return NO; the Orchestrator halts on a kill-switch.
- **Dogfood run:** run Constellation on one small real project end-to-end; inspect the KB it produced (are entries verified achievement-triples? are negative achievements captured?).
- **Compaction-survival check:** after a deliberate `/compact`, confirm an agent re-grounds correctly from files alone.

## 13. Open questions (resolve in planning or later)

1. ~~Relationship between Constellation's global KB and the existing memory system.~~ **Resolved:** sit beside, reuse the pattern, divide by role (see §10). The harness memory can't *be* the KB — it's path-scoped and can't travel cross-project.
2. ~~Concrete Orchestrator mechanics for relaying human gates.~~ **Resolved:** the Orchestrator is the **board scheduler** (§3.1) — human gates are cards assigned to the human; it advances cards and dispatches workers. Remaining sub-question: dispatch mechanism (poll-loop vs scheduler-dispatched ephemeral worker per card).
3. ~~Exact file/format conventions for the plan-artifact and the journal.~~ **Resolved:** see §3.3 (data model) — card, plan-artifact, and achievement-ledger schemas; Done card projects to ledger entry.
4. ~~How Critic's different-`model:` is chosen and whether always-on or stakes-gated.~~ **Resolved:** layered decorrelation stack, stakes-gated by `gravity` (§4.2). Cheap layers always on; different model + multi-lens vote gated by `gravity`.
