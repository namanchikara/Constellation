import { Command, Option } from 'commander';
import { fileURLToPath } from 'node:url';
import { createCard, moveCardInStore, listCardIds, readCard } from './store/cardStore.js';
import { createPlan } from './store/planStore.js';
import { markDone } from './ops/markDone.js';
import { regenerateCardIndex } from './store/indexer.js';
import { regeneratePlanIndex } from './store/planStore.js';
import { regenerateLedgerIndex } from './store/ledgerStore.js';
import type { CardState } from './domain/card.js';
import { CARD_STATES } from './domain/card.js';

export function run(argv: string[], root: string): void {
  const ok = (fn: () => void): void => {
    try { fn(); } catch (err) { console.log(`error: ${(err as Error).message}`); }
  };

  const program = new Command();
  program.name('constellation').exitOverride();

  const card = program.command('card');

  card
    .command('create')
    .requiredOption('--story <story>', 'user story')
    .option('--ac <criteria...>', 'acceptance criteria', [])
    .option('--plan <id>', 'parent plan id')
    .addOption(new Option('--gravity <gravity>', 'low|normal|high').choices(['low', 'normal', 'high']).default('normal'))
    .action((opts) => ok(() => {
      const c = createCard(root, {
        story: opts.story,
        acceptanceCriteria: opts.ac ?? [],
        plan: opts.plan,
        gravity: opts.gravity,
      });
      console.log(`created ${c.data.id} [${c.data.state}]`);
    }));

  card
    .command('move <id> <state>')
    .action((id: string, state: string) => ok(() => {
      if (!CARD_STATES.includes(state as CardState)) throw new Error(`unknown state: ${state}`);
      const c = moveCardInStore(root, id, state as CardState);
      console.log(`${c.data.id} → ${c.data.state} (${c.data.assignee})`);
    }));

  card
    .command('done <id>')
    .requiredOption('--achievement <text>')
    .requiredOption('--proof <text>')
    .option('--negative', 'record as a negative achievement', false)
    .action((id: string, opts) => ok(() => {
      const { entry } = markDone(root, id, {
        achievement: opts.achievement,
        proof: opts.proof,
        polarity: opts.negative ? 'negative' : 'positive',
      });
      console.log(`done ${id} → ledger ${entry.data.name}`);
    }));

  card.command('list').action(() => ok(() => {
    for (const id of listCardIds(root)) {
      const c = readCard(root, id);
      console.log(`${id} [${c.data.state}] (${c.data.assignee})`);
    }
  }));

  const plan = program.command('plan');
  plan.command('create').requiredOption('--problem <text>').action((opts) => ok(() => {
    const p = createPlan(root, { problem: opts.problem });
    console.log(`created ${p.data.id} [${p.data.status}]`);
  }));

  program.command('index').action(() => ok(() => {
    regenerateCardIndex(root);
    regeneratePlanIndex(root);
    regenerateLedgerIndex(root);
    console.log('regenerated board, plans, ledger indexes');
  }));

  try {
    program.parse(argv);
  } catch (err) {
    console.log(`error: ${(err as Error).message}`);
  }
}

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  run(process.argv, process.cwd());
}
