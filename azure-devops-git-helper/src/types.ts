export type ConventionalCommitType =
  | 'feat'
  | 'fix'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'docs'
  | 'build'
  | 'ci'
  | 'chore'
  | 'style';

export interface CommitInfo {
  id: string;
  message: string;
  author: string;
  date: string;
  isMerge?: boolean;
  isNoise?: boolean;
}

export interface ParsedCommit extends CommitInfo {
  type: ConventionalCommitType | 'unknown';
  scope?: string;
  description: string;
  breaking: boolean;
}

export interface AzureDevOpsContext {
  organization: string;
  project: string;
  repositoryId: string;
  repositoryName: string;
  pullRequestId: number;
  workItemId?: string;
  workItemTitle?: string;
  prTitle?: string;
  sourceBranch?: string;
  targetBranch?: string;
}

export interface PullRequestDescriptionGenerator {
  generate(commits: CommitInfo[], context: AzureDevOpsContext): Promise<string>;
}

export type AIProvider = 'openai' | 'anthropic' | 'azure-openai';

export interface ExtensionSettings {
  includeMergeCommits: boolean;
  groupByCategory: boolean;
  patToken: string;
  // Pro license key — required to unlock AI features
  licenseKey: string;
  // AI generation — disabled by default; uses template generator when off
  aiEnabled: boolean;
  aiProvider: AIProvider;
  aiApiKey: string;
  aiModel: string;
  aiAzureEndpoint: string; // only used when aiProvider === 'azure-openai'
}

// Default values live in config.ts to keep this file pure type definitions.
