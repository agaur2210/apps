import { CommitInfo, AzureDevOpsContext, PullRequestDescriptionGenerator } from '../../../types';
import { AIClient } from './client';

// Decorator: wraps any PullRequestDescriptionGenerator and refines its output
// with AI. The inner generator always runs first — AI only enriches the draft.
// Falls back to the inner draft transparently if the AI call fails.
export class AIRefinementDecorator implements PullRequestDescriptionGenerator {
  constructor(
    private readonly inner: PullRequestDescriptionGenerator,
    private readonly client: AIClient
  ) {}

  async generate(commits: CommitInfo[], context: AzureDevOpsContext): Promise<string> {
    const draft = await this.inner.generate(commits, context);
    try {
      return await this.client.refine(draft, commits, context);
    } catch (err) {
      console.warn('[GitHelper] AI refinement failed, using template draft:', err);
      return draft;
    }
  }
}
