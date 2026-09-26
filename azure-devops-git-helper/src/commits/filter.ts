import { CommitInfo } from '../types';
import { MERGE_PATTERNS, NOISE_PATTERNS } from '../config';

export function isMergeCommit(commit: CommitInfo): boolean {
  const msg = commit.message.trim();
  return MERGE_PATTERNS.some(p => p.test(msg));
}

export function isNoiseCommit(commit: CommitInfo): boolean {
  const msg = commit.message.trim();
  return NOISE_PATTERNS.some(p => p.test(msg));
}

export interface FilterOptions {
  includeMergeCommits: boolean;
}

export function filterCommits(commits: CommitInfo[], options: FilterOptions): CommitInfo[] {
  return commits
    .map(c => ({ ...c, isMerge: isMergeCommit(c), isNoise: isNoiseCommit(c) }))
    .filter(c => {
      if (!options.includeMergeCommits && c.isMerge) return false;
      if (c.isNoise) return false;
      return true;
    });
}

export function classifyCommits(commits: CommitInfo[]): CommitInfo[] {
  return commits.map(c => ({
    ...c,
    isMerge: isMergeCommit(c),
    isNoise: isNoiseCommit(c),
  }));
}
