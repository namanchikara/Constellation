# Constellation Plan 2 — Slice 1: Scout, end-to-end

> Status: built 2026-06-20, pending first dogfood. Plan 2 is the agents + orchestrator layer; we build it as **thin vertical slices** (one agent working on the real board) rather than designing all of it from priors.

## Why a slice, not the whole plan

Plan 2 is prose artifacts (agent definitions, orchestrator skill), verified by **dogfooding**, not unit tests. Designing all three agents + the scheduler up front would be building from priors — guessing how agents behave before watching one act. So: build Scout end-to-end on the real board, watch it, let reality shape Maker and Critic.

## Realization (decided)

- **Orchestrator** = a project skill, `.claude/skills/constellation/SKILL.md` — runs in the main thread, the only one who talks to the human, owns the kill-switches.
- **Agents** = Claude Code subagents under `.claude/agents/*.md`, dispatched by the orchestrator.
- **Board access** = agents call the `constellation` CLI (`npm run cli -- …`, from the repo root) built in Plan 1.
- **Human gate** = relayed by the orchestrator (this slice: Scout's `need_human` questions surfaced directly to the human).

## Deliverables (this slice)

1. `.constellation/agents/scout/purpose.md` — Scout's constitution (identity, raag/dwesha, polarized dream, prime directive, failure-modes + equanimity guards, the reflex, kill-switch, definition of "verified problem"). Read first at every boot.
2. `.claude/agents/scout.md` — the Scout subagent: boot sequence (read purpose.md → re-ground from board/ledger → task), the board-CLI surface it may use, and a structured **return contract** (`need_human | verified | not_real | sorry_context`).
3. `.claude/skills/constellation/SKILL.md` — the orchestrator loop for the Scout slice: dispatch Scout → read STATUS → relay/loop/report; kill-switch at the human gate.

## Definition of done for the slice

A live run where Scout, given a real problem, either (a) writes a **verified-problem plan** to the real board after genuine interrogation + evidence + human confirmation, or (b) returns **not_real** with reasoning — and in both cases honors the kill-switch. Watch for Scout's characteristic failure modes (sycophancy; manufacturing a problem) and whether the equanimity guards hold.

## Next slices (not now)

- Slice 2: **Maker** — build solution Y for a verified plan; cards through `in-progress`.
- Slice 3: **Critic** — refute in `in-testing`, decorrelated (framing + different model + nightmare dream); `card done` projects the verified achievement to the ledger.
- Later / v2: the gravity / self-improvement "retro" layer, designed from real run data.
