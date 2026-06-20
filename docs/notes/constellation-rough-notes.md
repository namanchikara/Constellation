# Constellation — rough design notes (pre-spec)

> Status: brainstorming, not yet a spec. Rough capture of where we are.

## What it is
- (a) Reusable agent methodology for ANY project, in Claude Code +
- (c) layered learning KB: (2a) persist context now, (2b) self-improve later (v2).

## Core philosophy ("stay with reality")
- Priors **propose**, reality **disposes**, the human **arbitrates intent**.
- Priors = hypotheses, not verdicts. Verify understanding before concluding.
- Ask about the **problem/job**, never the **solution** (Ford: faster horses).
- Both ends fail: over-ask (faster horses) AND under-ask (Segway). Reality is the only anchor.
- **Kill-switch at every gate** — every check must be able to come back NO, or it's theater.
- The auditor problem: "can't fully audit yourself with the organ you're auditing."
- Correlated failure: two copies of same model share blind spots → agreement is near-worthless unless DECORRELATED (adversarial framing / different model / different priors).

## Team (v1) — roles = failure-classes, not bureaucracy
- **Scout (PO):** "wrong problem." Asks human the problem, verifies it's REAL before any build. Gates 1-2.
- **Maker (dev, design folded in):** "wrong build." Proposes solution Y, builds.
- **Critic (QA, adversarial):** "broken/off-target." Job = REFUTE. Sees output+spec, NOT Maker's reasoning. Ideally different `model:`.
- UX/behavioral = a LENS, not its own agent in v1.

## Substrate (Q4 → settled toward subagents+KB)
- File-backed subagents + persistent KB. NOT tmux (comms = no native bus, unbounded cost, doesn't fix correlation; only wins live-watch).
- **"Persistent agent" = stateless agent + persistent KB.** Persistence lives in FILES, not processes. Re-read slice each spawn.

## KB design
- One fact per file + frontmatter (`name` + `description` = lazy-load trigger). Index = only thing loaded by default.
- Lazy-load by relevance ("read as per need"). + temporal load (see boot seq).
- Two scopes: global (prefs, gravity) + project-local (problem, decisions, Critic findings, **kill-switch fires = what we did NOT build & why**).
- Caveats: trigger quality = whole ballgame; write-discipline or it rots; **KB is itself a pile of priors → verify, don't trust.**

## Per-agent boot sequence (the "wake-up")
1. `purpose.md` — long-lived identity/role (where Critic's "refute" lives).
2. **Polarized dream** (decorrelation by construction):
   - Scout dreams: problem doesn't exist / already solved.
   - Maker dreams: solved beautifully, users thrilled.
   - Critic dreams: NIGHTMARE — shipped and everything broke.
   - Dream = aspiration to FALSIFY, not fact to assume. Keep short.
3. Last N tasks = summary (low-res). Last 2 = detailed journal (hi-res).
4. Current task context → go.

## Per-task reflex (after boot, every incoming ask)
1. Comprehend; does it fit my context?
2. If not → "Sorry, context?" (refuse-and-ask, NOT confabulate). ← cure for hallucination.
3. If yes → before acting: **is it true?** (reality gate) + **is it necessary?** (YAGNI gate).
4. "Gravity" = adaptive threshold on those gates → tuned by v2 learning layer.

## Open / deferred
- Relationship of Constellation global KB to existing ~/.claude/.../memory/ (decide later).
- v2 self-improvement layer (gravity calibration) — design FROM real run data, not priors.
- Orchestration details (how orchestrator relays human gates).
