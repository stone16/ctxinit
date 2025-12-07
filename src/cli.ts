import { Command } from 'commander';

const program = new Command();

program
  .name('ctx')
  .description('Unified context architecture for AI coding assistants')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize .context directory in your project')
  .option('-f, --force', 'Overwrite existing .context directory')
  .option('--no-interactive', 'Run without prompts (use defaults)')
  .action((_options) => {
    // eslint-disable-next-line no-console
    console.log('ctx init - Coming in Phase 5');
  });

program
  .command('build')
  .description('Compile rules into target formats')
  .option('-i, --incremental', 'Only rebuild changed files')
  .option('-v, --verbose', 'Show detailed output')
  .option('-q, --quiet', 'Suppress output except errors')
  .action((_options) => {
    // eslint-disable-next-line no-console
    console.log('ctx build - Coming in Phase 4');
  });

program
  .command('lint')
  .description('Validate rules without building')
  .option('--json', 'Output in JSON format')
  .action((_options) => {
    // eslint-disable-next-line no-console
    console.log('ctx lint - Coming in Phase 5');
  });

export function run(): void {
  program.parse();
}
