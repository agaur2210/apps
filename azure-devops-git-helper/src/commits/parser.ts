import { CommitInfo, ParsedCommit, ConventionalCommitType } from '../types';

const CONVENTIONAL_PATTERN = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

const KNOWN_TYPES = new Set<ConventionalCommitType>([
  'feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'style',
]);

export function parseCommit(commit: CommitInfo): ParsedCommit {
  const firstLine = commit.message.trim().split('\n')[0];
  const match = firstLine.match(CONVENTIONAL_PATTERN);

  if (!match) {
    return { ...commit, type: 'unknown', description: firstLine, breaking: false };
  }

  const [, rawType, scope, bang, description] = match;
  const type: ConventionalCommitType | 'unknown' = KNOWN_TYPES.has(rawType as ConventionalCommitType)
    ? (rawType as ConventionalCommitType)
    : 'unknown';

  return {
    ...commit,
    type,
    scope: scope ?? undefined,
    description: description.trim(),
    breaking: !!bang,
  };
}

export function commitToSentence(parsed: ParsedCommit): string {
  const { type, scope, description } = parsed;

  const cap   = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const period = (s: string) => (s.endsWith('.') ? s : `${s}.`);
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const bt    = (s: string) => `\`${s}\``;

  switch (type) {
    case 'feat':     return period(`Added ${lower(cap(description))}`);
    case 'fix':      return scope
                       ? period(`Fixed ${lower(description)} in ${bt(scope)}`)
                       : period(`Fixed ${lower(description)}`);
    case 'refactor': return scope
                       ? period(`Refactored ${lower(description)} into ${bt(scope)}`)
                       : period(`Refactored ${lower(description)}`);
    case 'perf':     return period(`${cap(description)} to improve performance`);
    case 'test':     return period(`Added tests covering ${lower(description)}`);
    case 'docs':     return period(`Updated documentation for ${lower(description)}`);
    case 'build':    return period(`Updated build configuration for ${lower(description)}`);
    case 'ci':       return period(`Updated CI/CD configuration for ${lower(description)}`);
    case 'chore':    return period(`Updated ${lower(description)}`);
    case 'style':    return period(`Improved code style for ${lower(description)}`);
    default:         return period(cap(description));
  }
}
