import { CommitInfo, AzureDevOpsContext, PullRequestDescriptionGenerator, ParsedCommit } from '../../types';
import { parseCommit, commitToSentence } from '../../commits/parser';
import { GROUP_THRESHOLD, CATEGORY_ORDER, TYPE_TO_CATEGORY } from '../../config';

export class CommitTemplateDescriptionGenerator implements PullRequestDescriptionGenerator {
  async generate(commits: CommitInfo[], context: AzureDevOpsContext): Promise<string> {
    if (commits.length === 0) {
      return this.formatDescription('- No significant changes detected.', context);
    }

    const parsed = commits.map(parseCommit);
    const deduplicated = deduplicateCommits(parsed);
    const changesSection = deduplicated.length >= GROUP_THRESHOLD
      ? formatGrouped(deduplicated)
      : formatSimple(deduplicated);

    return this.formatDescription(changesSection, context);
  }

  private formatDescription(changesSection: string, context: AzureDevOpsContext): string {
    const summaryLine = buildSummaryLine(context);
    const workItemSection = context.workItemId
      ? `\n\n## Related Work Item\n\n#${context.workItemId}`
      : '';

    return [
      '## Summary', '', summaryLine,
      '', '## Changes', '', changesSection,
      '', '## Testing', '',
      '- [ ] Unit tests',
      '- [ ] Integration tests',
      '- [ ] Manual verification',
      workItemSection,
    ].join('\n').trimEnd();
  }
}

function buildSummaryLine(context: AzureDevOpsContext): string {
  if (context.workItemId && context.workItemTitle) {
    return `Implements #${context.workItemId} — ${context.workItemTitle}.`;
  }
  if (context.prTitle) return `${context.prTitle}.`;
  return 'See changes below.';
}

function deduplicateCommits(parsed: ParsedCommit[]): ParsedCommit[] {
  const groups = new Map<string, ParsedCommit[]>();

  for (const commit of parsed) {
    const key = `${commit.type}::${commit.scope ?? ''}`;
    const group = groups.get(key) ?? [];
    group.push(commit);
    groups.set(key, group);
  }

  const result: ParsedCommit[] = [];
  for (const group of groups.values()) {
    result.push(group.length === 1 ? group[0] : mergeGroup(group));
  }
  return result;
}

function mergeGroup(group: ParsedCommit[]): ParsedCommit {
  const primary =
    group.find(c => c.type === 'feat') ??
    group.find(c => c.type === 'refactor') ??
    group.reduce((a, b) => (a.description.length >= b.description.length ? a : b));

  const primaryWords = new Set(primary.description.toLowerCase().split(/\W+/));
  const addendums = group
    .filter(c => c !== primary)
    .map(c => c.description.toLowerCase())
    .filter(e => e.split(/\W+/).some((w: string) => w.length > 4 && !primaryWords.has(w)));

  if (addendums.length > 0) {
    return { ...primary, description: `${primary.description} (with ${addendums.join('; ')})` };
  }
  return primary;
}

function formatSimple(parsed: ParsedCommit[]): string {
  return parsed.map(p => `- ${commitToSentence(p)}`).join('\n');
}

function formatGrouped(parsed: ParsedCommit[]): string {
  const buckets = new Map<string, ParsedCommit[]>();
  for (const commit of parsed) {
    const category = TYPE_TO_CATEGORY[commit.type] ?? 'Other Changes';
    const bucket = buckets.get(category) ?? [];
    bucket.push(commit);
    buckets.set(category, bucket);
  }

  return CATEGORY_ORDER
    .filter(cat => buckets.has(cat))
    .map(cat => `### ${cat}\n\n${buckets.get(cat)!.map(p => `- ${commitToSentence(p)}`).join('\n')}`)
    .join('\n\n');
}
