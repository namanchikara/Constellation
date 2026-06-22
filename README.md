# Constellation

A **reusable multi-agent methodology** for doing project work inside Claude Code, plus a **persistent, layered knowledge base** that gives a human and a team of agents continuity across sessions and projects.

It exists to counter the known failure modes of LLM work — confident wrongness, drift over long tasks, "sounds done" instead of "is done," and building the wrong thing efficiently — with a single discipline applied everywhere: **stay with reality.**

> **Status: v1, in progress.** The board substrate (CLI + data model) is built and green (48 tests). The agent team is being grown one vertical slice at a time: **Scout** and **Maker** are built; **Critic** is next. The v2 self-improvement layer is deliberately deferred until there's real run data to design it from.

## The core idea — "stay with reality"

Priors propose, reality disposes, the human arbitrates intent. A prior is a hypothesis, never a verdict.

1. **Priors propose, reality disposes, the human arbitrates.** Verify understanding before concluding.
2. **Ask about the problem, never the solution.** (Ford's "faster horses.") Reality is the only anchor that survives both over-asking and lone-vision.
3. **Kill-switch at every gate.** Every check must be able to come back NO. A check that can only say "yes" is theater.
4. **The auditor problem.** You can't fully audit yourself with the organ you're auditing — route verification to something that *isn't* the same model: a compiler, a test, the running app, the human, or a deliberately **decorrelated** second agent.
5. **Correlated failure is the enemy.** Two copies of one model share blind spots, so their agreement is near-worthless unless their framing, priors, or model are made different on purpose.

Every agent holds two questions about *its own product*: **are we building the right product?** (validation) and **are we building the product right?** (verification). Both are everyone's job — what differs is each agent's product.

## The team — roles are failure-classes, not bureaucracy

| Agent | Owns failure-class | Job | Decorrelation |
|---|---|---|---|
| **Scout** (PO) | wrong problem | Ask the human about the problem; verify it's **real** before any build. | dreams the problem may not exist / is already solved |
| **Maker** (dev) | wrong build | Propose solution Y for sign-off, then build it minimally. | dreams it's solved beautifully, users thrilled |
| **Critic** (QA) *— not yet built* | broken / off-target | **Refute.** Sees the output + spec, **not** Maker's reasoning. Ideally a different model. | wakes from a nightmare: it shipped and everything broke |

The **Orchestrator** runs in the main thread (a Claude Code skill). It's the only one who talks to the human, relays between agents, runs the gates, and owns the kill-switches. Agents are headless subagents.

## How agents coordinate — the board

Agents coordinate through a shared **Kanban board** that is simultaneously the message bus, the human-in-the-loop surface, and the gates made visible.

- **Persistent board, disposable workers.** The board is the durable state; a worker is spawned to act on a card, re-hydrates from board + KB, and may die between cards. Continuity is always recoverable from the board, never from a live process.
- **Columns are gates:** `backlog → todo → in-progress → in-testing → done`. A card **cannot skip `in-testing`** (the "is it true?" guard). **`done` = a verified achievement**, which projects an achievement-triple into the ledger.
- **`state` is a frontmatter field, not a folder.** A card moves by changing `state`, never by moving files — preserving history and a single source of truth. Columns are a *view*.
- **Human arbitration = a card assigned to `human`.** That replaces any "need_human" relay.

Everything is **one entity per file, Markdown + YAML frontmatter, with an index per store.** Frontmatter is machine-routable; the body is human/agent-readable prose. IDs are sequential + slug (`0007-export-csv`).

## The CLI

The board, plans, and ledger are driven by the `constellation` CLI, which operates on the directory you run it from (`.constellation/` within it).

```bash
npm install
npm run build        # compile TypeScript to dist/
npm test             # vitest — 48 tests

# Drive the board (from the target project dir):
npm run cli -- plan create --problem "analysts can't get data out of the tool"
npm run cli -- card create --story "As an analyst, I want CSV export so that I can share with non-users" \
                           --ac "correct headers" "10k rows < 2s" --gravity normal
npm run cli -- card list
npm run cli -- card move 0001-... in-progress
npm run cli -- card done 0001-... --achievement "CSV export works" --proof "acceptance criteria pass + Critic verdict"
npm run cli -- index    # regenerate board / plan / ledger indexes
```

`card done` is the one-way valve from work into memory: a Done card projects **near-mechanically** into a ledger entry — the story's "so that" becomes *purpose*, the acceptance criteria + verdict become *proof*, the outcome becomes the *achievement*. Negative achievements ("approach A is a dead end, because R") are first-class (`--negative`).

## Repo layout

```
src/                 TypeScript CLI — domain / store / ops / fs, board+plan+ledger as markdown+frontmatter
.claude/
  skills/constellation/SKILL.md   the orchestrator (runs in the main thread, owns kill-switches)
  agents/{scout,maker}.md         the subagents
.constellation/
  agents/<name>/purpose.md        each agent's constitution — read first at every boot
docs/superpowers/
  specs/2026-06-20-constellation-design.md          the full design spec (read this)
  plans/                                            Plan 1 (board substrate), Plan 2 (Scout slice)
```

## Using it

Bring a problem to the orchestrator skill (`/constellation`). It dispatches **Scout** to verify the problem is real — relaying Scout's questions to you at the human gate, and reporting back either a verified plan on the board *or* "not real — don't build" (building nothing is a correct, successful outcome). Once a plan is verified, **Maker** proposes an approach for your sign-off, then builds it card by card, leaving each at `in-testing`. The Critic gate (`in-testing → done`) lands in the next slice.

## Why it's built this way

A methodology is verified by **use, not unit tests alone.** Plan 1 (the board substrate) was test-driven because it's mechanical. Plan 2 (the agents) is built as thin vertical slices verified by **dogfooding** — build one agent on the real board, let reality shape the next — because prose contracts can't be meaningfully unit-tested. The v2 "gravity" self-improvement layer is withheld on purpose: it can only be designed honestly from real run data, not from priors.
